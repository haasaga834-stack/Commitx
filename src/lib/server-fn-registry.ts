/**
 * Eagerly pulls every server-function module into the server graph.
 *
 * The dev server only knows a server function's id once the module holding it
 * has been transformed on the server. Client-side navigation to a page never
 * triggers that, so the first call to e.g. createGroup could fail with an
 * "invalid server function id" 500. Importing them here at server startup keeps
 * every id registered from the first request onwards.
 */
import "./account.functions";
import "./community.functions";
import "./group-study.functions";
import "./wallet.functions";
