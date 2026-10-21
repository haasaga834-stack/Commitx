import { useCallback, useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

/** Pair hash helper (kept for tests); the live room comes from the server-only pair secret. */
export async function buddyCamRoom(a: string, b: string) {
  const pair = [a, b].sort().join(":");
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`commitx-cam:${pair}`));
  const hex = Array.from(new Uint8Array(bytes), (x) => x.toString(16).padStart(2, "0")).join("");
  return `buddy-cam-${hex.slice(0, 40)}`;
}

/** The lower id makes the offer so both phones never call at once. */
export function isCaller(myId: string, buddyId: string) {
  return myId < buddyId;
}

const ICE: RTCConfiguration = {
  iceServers: [{ urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] }],
};

type Signal =
  | { kind: "hello"; from: string }
  | { kind: "bye"; from: string }
  | { kind: "sdp"; from: string; to: string; sdp: RTCSessionDescriptionInit }
  | { kind: "ice"; from: string; to: string; candidate: RTCIceCandidateInit };

export type CamState = "off" | "starting" | "waiting" | "connected" | "error";

/**
 * Peer-to-peer video between two study buddies. Media never touches a server;
 * only the connection handshake passes through a private realtime channel.
 * The microphone always starts muted; there is no text chat.
 */
export function useBuddyCam(myId: string | null, buddyId: string | null) {
  const [state, setState] = useState<CamState>("off");
  const [error, setError] = useState<string | null>(null);
  const [local, setLocal] = useState<MediaStream | null>(null);
  const [remote, setRemote] = useState<MediaStream | null>(null);
  const [micOn, setMicOn] = useState(false);
  const [camOn, setCamOn] = useState(true);
  const pc = useRef<RTCPeerConnection | null>(null);
  const ch = useRef<RealtimeChannel | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const pendingIce = useRef<RTCIceCandidateInit[]>([]);

  const send = (payload: Signal) => {
    void ch.current?.send({ type: "broadcast", event: "signal", payload });
  };

  const closePeer = () => {
    pc.current?.close();
    pc.current = null;
    pendingIce.current = [];
    setRemote(null);
  };

  const newPeer = useCallback(() => {
    closePeer();
    if (!myId || !buddyId || !stream.current) return null;
    const peer = new RTCPeerConnection(ICE);
    stream.current.getTracks().forEach((t) => peer.addTrack(t, stream.current!));
    peer.onicecandidate = (e) => {
      if (e.candidate) send({ kind: "ice", from: myId, to: buddyId, candidate: e.candidate.toJSON() });
    };
    peer.ontrack = (e) => {
      setRemote(e.streams[0] ?? new MediaStream([e.track]));
      setState("connected");
    };
    peer.onconnectionstatechange = () => {
      if (["failed", "disconnected", "closed"].includes(peer.connectionState) && pc.current === peer) {
        setRemote(null);
        setState("waiting");
      }
    };
    pc.current = peer;
    return peer;
  }, [myId, buddyId]);

  const stop = useCallback(() => {
    if (myId) send({ kind: "bye", from: myId });
    closePeer();
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    setLocal(null);
    if (ch.current) void supabase.removeChannel(ch.current);
    ch.current = null;
    setMicOn(false);
    setCamOn(true);
    setState("off");
  }, [myId]);

  const start = useCallback(async () => {
    if (!myId || !buddyId || ch.current) return;
    setError(null);
    setState("starting");
    try {
      const media = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 480 }, height: { ideal: 640 }, frameRate: { ideal: 15, max: 20 } },
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      media.getAudioTracks().forEach((t) => (t.enabled = false));
      stream.current = media;
      setLocal(media);
    } catch {
      setError("Allow camera and microphone access to study together.");
      setState("error");
      return;
    }

    const { data: room } = await supabase.rpc("buddy_cam_room");
    if (!room) {
      stream.current?.getTracks().forEach((t) => t.stop());
      stream.current = null;
      setLocal(null);
      setError("Study cam works only with your current study buddy.");
      setState("error");
      return;
    }
    const channel = supabase.channel(room, { config: { broadcast: { self: false } } });
    ch.current = channel;
    channel.on("broadcast", { event: "signal" }, async ({ payload }) => {
      const s = payload as Signal;
      if (s.from !== buddyId) return; // Only the paired buddy may connect.
      if ("to" in s && s.to !== myId) return;
      try {
        if (s.kind === "hello") {
          if (isCaller(myId, buddyId)) {
            const peer = newPeer();
            if (!peer) return;
            await peer.setLocalDescription(await peer.createOffer());
            send({ kind: "sdp", from: myId, to: buddyId, sdp: peer.localDescription!.toJSON() });
          } else if (!pc.current) {
            send({ kind: "hello", from: myId });
          }
        } else if (s.kind === "sdp") {
          if (s.sdp.type === "offer") {
            const peer = newPeer();
            if (!peer) return;
            await peer.setRemoteDescription(s.sdp);
            await peer.setLocalDescription(await peer.createAnswer());
            send({ kind: "sdp", from: myId, to: buddyId, sdp: peer.localDescription!.toJSON() });
          } else if (pc.current) {
            await pc.current.setRemoteDescription(s.sdp);
          }
          for (const c of pendingIce.current.splice(0)) await pc.current?.addIceCandidate(c);
        } else if (s.kind === "ice") {
          if (pc.current?.remoteDescription) await pc.current.addIceCandidate(s.candidate);
          else pendingIce.current.push(s.candidate);
        } else if (s.kind === "bye") {
          closePeer();
          setState("waiting");
        }
      } catch {
        /* a fresh hello retries the handshake */
      }
    });
    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        setState("waiting");
        send({ kind: "hello", from: myId });
      }
    });
  }, [myId, buddyId, newPeer]);

  // Re-announce while waiting so a buddy who joins later still connects.
  useEffect(() => {
    if (state !== "waiting" || !myId) return;
    const t = window.setInterval(() => send({ kind: "hello", from: myId }), 4000);
    return () => window.clearInterval(t);
  }, [state, myId]);

  useEffect(() => () => stop(), [stop]);

  const toggleMic = () => {
    const next = !micOn;
    stream.current?.getAudioTracks().forEach((t) => (t.enabled = next));
    setMicOn(next);
  };
  const toggleCam = () => {
    const next = !camOn;
    stream.current?.getVideoTracks().forEach((t) => (t.enabled = next));
    setCamOn(next);
  };

  return { state, error, local, remote, micOn, camOn, start, stop, toggleMic, toggleCam };
}
