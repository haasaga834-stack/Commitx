import { plantGrowth } from '@/lib/plant-growth';

const SOIL = 250;
const branches = [0.16, 0.28, 0.4, 0.52, 0.64, 0.76, 0.87];

function leafPath(side: number, length: number) {
  return `M0 0 C${side * length * 0.25} -13 ${side * length * 0.7} -17 ${side * length} -7 L${side * length * 0.92} -1 C${side * length * 0.65} 9 ${side * length * 0.25} 10 0 0 Z`;
}

/** A single rooted plant, not a row of stages; all stages follow elapsed time. */
export function GrowingPlant({ progress }: { progress: number }) {
  const growth = plantGrowth(progress);
  const height = growth.stem * 198;
  return (
    <div className="cx-growing-plant absolute inset-0" data-plant-progress={growth.progress}>
      <svg viewBox="0 0 400 280" preserveAspectRatio="xMidYMax meet" className="cx-growing-plant-art">
        <ellipse cx="200" cy="259" rx="60" ry="6" fill="var(--plant-shadow)" />
        <path d="M141 254 L155 248 165 248 175 239 187 242 195 236 210 239 218 244 231 245 241 251 257 253 260 258 231 262 203 260 175 263 151 259Z" fill="var(--plant-soil)" />
        <path d="M165 248 L175 239 187 242 195 236 210 239 220 246 203 244 186 247Z" fill="var(--plant-soil-light)" />
        <ellipse cx="200" cy="242" rx="5" ry="3.2" transform="rotate(-24 200 242)" fill="var(--plant-seed)" opacity={growth.seed} />
        <g className="animate-plant-sway" style={{ transformOrigin: '200px 250px', transformBox: 'view-box' }}>
          <path d={`M200 ${SOIL} Q193 ${SOIL - height * 0.45} 205 ${SOIL - height}`} stroke="var(--plant-stem)" strokeWidth={2 + growth.stem * 2} strokeLinecap="round" fill="none" opacity={Math.min(1, growth.stem * 20)} />
          {branches.map((along, index) => {
            const y = SOIL - 198 * along;
            const unfurl = Math.min(1, Math.max(0, (height - 198 * along) / 26));
            if (unfurl <= 0) return null;
            return [-1, 1].map((side) => {
              const length = (index % 2 ? 47 : 40) * unfurl;
              const branchY = -18 - (index % 3) * 5;
              return (
                <g key={`${index}-${side}`} transform={`translate(200 ${y})`} opacity={unfurl}>
                  <path d={`M0 0 Q${side * length * 0.6} -10 ${side * length} ${branchY}`} stroke="var(--plant-stem)" strokeWidth="2" fill="none" />
                  <g transform={`translate(${side * length} ${branchY}) scale(${unfurl}) rotate(${side * -12})`}>
                    <path d={leafPath(side, 26)} fill={index % 2 ? 'var(--plant-leaf)' : 'var(--plant-leaf-light)'} />
                    <path d={`M0 0 Q${side * 12} -5 ${side * 23} -6`} stroke="var(--plant-vein)" strokeWidth="0.7" fill="none" />
                  </g>
                  {index > 1 && index < 6 && side === (index % 2 ? -1 : 1) && (
                    <g transform={`translate(${side * length * 0.648} ${-4.8 + 0.36 * branchY})`}>
                      <g opacity={growth.flowers} transform={`scale(${0.3 + growth.flowers * 0.7})`}>
                        {[0, 72, 144, 216, 288].map((angle) => <path key={angle} d="M0 0 L-3 -6 0 -12 3 -6Z" transform={`rotate(${angle})`} fill="var(--plant-flower)" />)}
                        <circle r="2.5" fill="var(--plant-flower-center)" />
                      </g>
                      <path d={`M0 0 Q${side * 4} 6 0 ${4 + growth.fruit * 8}`} stroke="var(--plant-stem)" strokeWidth="1.4" fill="none" strokeLinecap="round" opacity={growth.fruit} />
                      <g opacity={growth.fruit} transform={`translate(0 ${4 + growth.fruit * 14}) scale(${0.3 + growth.fruit * 0.7})`}>
                        <path d="M0 -6 Q-14 -12 -13 2 Q-12 15 0 14 Q13 14 13 1 Q13 -11 0 -6Z" fill="var(--plant-fruit)" />
                        <ellipse cx="-5" cy="0" rx="2" ry="4" fill="var(--plant-fruit-shine)" />
                        <path d="M0 -6 L-6 -10 -3 -5 -7 -4 0 -3 6 -5 3 -6 4 -11Z" fill="var(--plant-leaf)" />
                      </g>
                    </g>
                  )}
                </g>
              );
            });
          })}
          <g transform={`translate(205 ${SOIL - height}) scale(${Math.min(1, growth.stem * 15)})`}>
            <path d="M0 0 C-13 -8 -6 -23 4 -29 C12 -20 12 -6 0 0Z" fill="var(--plant-leaf-light)" />
          </g>
        </g>
      </svg>
    </div>
  );
}