/**
 * Generates and verifies the design-direction palette: OKLCH -> sRGB (Ottosson transform)
 * plus WCAG 2.2 contrast ratios, so every number in docs/design/direction.md §4 is computed
 * rather than eyeballed. Run with `node docs/design/palette.mjs`. No dependencies.
 */
const f=(x)=>x<=0.0031308?12.92*x:1.055*Math.pow(x,1/2.4)-0.055;
function oklch(L,C,H){
  const h=H*Math.PI/180, a=C*Math.cos(h), b=C*Math.sin(h);
  const l_=L+0.3963377774*a+0.2158037573*b, m_=L-0.1055613458*a-0.0638541728*b, s_=L-0.0894841775*a-1.2914855480*b;
  const l=l_**3,m=m_**3,s=s_**3;
  const r= 4.0767416621*l-3.3077115913*m+0.2309699292*s;
  const g=-1.2684380046*l+2.6097574011*m-0.3413193965*s;
  const bl=-0.0041960863*l-0.7034186147*m+1.7076147010*s;
  const clip=(v)=>Math.min(1,Math.max(0,v));
  const out=[r,g,bl].map(f).map(clip);
  const gamut = [r,g,bl].map(f).every(v=>v>=-0.001&&v<=1.001);
  return {rgb:out.map(v=>Math.round(v*255)), gamut};
}
const hex=(rgb)=>'#'+rgb.map(v=>v.toString(16).padStart(2,'0')).join('');
const lin=(c)=>{c/=255;return c<=0.04045?c/12.92:Math.pow((c+0.055)/1.055,2.4)};
const lum=(rgb)=>0.2126*lin(rgb[0])+0.7152*lin(rgb[1])+0.0722*lin(rgb[2]);
const ratio=(a,b)=>{const [x,y]=[lum(a),lum(b)].sort((p,q)=>q-p);return (x+0.05)/(y+0.05)};

const T={
  // LIGHT
  'paper':        [0.988,0.004,250],
  'paper-sunk':   [0.965,0.006,250],
  'rule':         [0.900,0.010,250],
  'rule-strong':  [0.800,0.014,250],
  'field':        [0.650,0.018,250],
  'focus':        [0.520,0.105,240],
  'ink':          [0.235,0.028,250],
  'ink-muted':    [0.520,0.020,250],
  'queued':       [0.520,0.020,250],
  'processing':   [0.520,0.105,240],
  'completed':    [0.480,0.110,152],
  'attention':    [0.520,0.105, 72],
  'failed':       [0.520,0.180, 25],
  // DARK
  'd-paper':       [0.190,0.012,250],
  'd-paper-sunk':  [0.230,0.014,250],
  'd-rule':        [0.320,0.016,250],
  'd-rule-strong': [0.420,0.018,250],
  'd-field':       [0.520,0.020,250],
  'd-focus':       [0.760,0.110,240],
  'd-ink':         [0.930,0.008,250],
  'd-ink-muted':   [0.700,0.014,250],
  'd-queued':      [0.700,0.014,250],
  'd-processing':  [0.760,0.110,240],
  'd-completed':   [0.780,0.110,152],
  'd-attention':   [0.820,0.120, 72],
  'd-failed':      [0.740,0.130, 25],
};
const C={};
for(const [k,v] of Object.entries(T)){const o=oklch(...v);C[k]={hex:hex(o.rgb),rgb:o.rgb,gamut:o.gamut,oklch:`oklch(${v[0]} ${v[1]} ${v[2]})`}}
for(const [k,v] of Object.entries(C)) console.log(k.padEnd(14), v.hex, v.oklch.padEnd(26), v.gamut?'':'OUT-OF-GAMUT');

console.log('\n--- LIGHT: text on paper (need 4.5) ---');
for(const k of ['ink','ink-muted','queued','processing','completed','attention','failed'])
  console.log(k.padEnd(12), ratio(C[k].rgb,C['paper'].rgb).toFixed(2));
console.log('--- LIGHT: on paper-sunk (need 4.5) ---');
for(const k of ['ink','ink-muted','processing','completed','attention','failed'])
  console.log(k.padEnd(12), ratio(C[k].rgb,C['paper-sunk'].rgb).toFixed(2));
console.log('--- LIGHT: non-text 3:1 on paper (SC 1.4.11) ---');
for(const k of ['rule','rule-strong','field','focus','ink','processing','completed','attention','failed'])
  console.log(k.padEnd(12), ratio(C[k].rgb,C['paper'].rgb).toFixed(2));
console.log('paper on ink (button)', ratio(C['paper'].rgb,C['ink'].rgb).toFixed(2));

console.log('\n--- DARK: text on d-paper (need 4.5) ---');
for(const k of ['d-ink','d-ink-muted','d-queued','d-processing','d-completed','d-attention','d-failed'])
  console.log(k.padEnd(14), ratio(C[k].rgb,C['d-paper'].rgb).toFixed(2));
console.log('--- DARK: non-text 3:1 on d-paper ---');
for(const k of ['d-rule','d-rule-strong','d-field','d-focus','d-processing','d-completed','d-attention','d-failed'])
  console.log(k.padEnd(14), ratio(C[k].rgb,C['d-paper'].rgb).toFixed(2));
console.log('d-paper on d-ink (button)', ratio(C['d-paper'].rgb,C['d-ink'].rgb).toFixed(2));

console.log('\n--- greyscale separation (relative luminance, status colours) ---');
for(const k of ['queued','processing','completed','attention','failed'])
  console.log(k.padEnd(12), lum(C[k].rgb).toFixed(4));
