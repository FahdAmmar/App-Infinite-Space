import type { CanvasEdge, EdgeArrow, EdgeColorId, EdgeCurve, EdgeLineStyle, HandleSide } from '@/features/canvas/types/edges'
import type { CanvasNode, StickyColorId } from '@/features/canvas/types/nodes'
import { NODE_SIZES } from '@/features/canvas/utils/constants'
import { getAbsolutePosition } from '@/features/canvas/utils/group-utils'

/**
 * العارض المستقل: ملف HTML واحد للقراءة فقط، يفتح بلا التطبيق وبلا شبكة، فيصلح للمشاركة والأرشفة.
 * الأمان: بيانات المستخدم تُدمج كـ JSON داخل <script type="application/json"> بعد تهريب كل ما قد يغلق الوسم،
 * ويبني العارض عناصره بـ textContent فقط (لا innerHTML إطلاقاً)، والروابط http/https فقط، والصور data: لصيغ نقطية فقط،
 * وCSP صارمة داخل الملف نفسه تمنع أي اتصال بالشبكة.
 */

export interface ViewerNode {
  id: string
  kind: CanvasNode['type']
  x: number
  y: number
  w: number
  h: number
  title: string
  text: string
  color: StickyColorId | null
  url: string
  tags: string[]
  /** data URI لصورة نقطية، أو null */
  image: string | null
}

export interface ViewerEdge {
  from: string
  to: string
  fromSide: HandleSide
  toSide: HandleSide
  label: string
  color: EdgeColorId
  curve: EdgeCurve
  line: EdgeLineStyle
  arrow: EdgeArrow
}

export interface ViewerData {
  name: string
  description: string
  exportedAt: number
  nodes: ViewerNode[]
  edges: ViewerEdge[]
}

const SAFE_IMAGE_URI = /^data:image\/(?:png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/
const SAFE_LINK = /^https?:\/\//i

const FALLBACK_SIZE = { width: 240, height: 160 }

function sizeOf(node: CanvasNode): { w: number; h: number } {
  const fallback = NODE_SIZES[node.type === 'image' ? 'sticky' : node.type] ?? FALLBACK_SIZE
  return { w: node.width ?? node.measured?.width ?? fallback.width, h: node.height ?? node.measured?.height ?? fallback.height }
}

/** من نموذج اللوحة إلى بيانات العارض: مواضع مطلقة (العارض لا يعرف العضوية)، ونصوص جاهزة، وصور محققة. */
export function buildViewerData(input: {
  name: string
  description: string
  nodes: readonly CanvasNode[]
  edges: readonly CanvasEdge[]
  /** صور البطاقات كـ data URI، بمفتاح imageId */
  images: Readonly<Record<string, string>>
  exportedAt: number
}): ViewerData {
  const byId = new Map(input.nodes.map((node) => [node.id, node]))
  // المجموعات أولاً كي تُرسم تحت بطاقاتها
  const ordered = [...input.nodes.filter((node) => node.type === 'group'), ...input.nodes.filter((node) => node.type !== 'group')]

  const nodes = ordered.map((node): ViewerNode => {
    const { x, y } = getAbsolutePosition(node, byId)
    const { w, h } = sizeOf(node)
    const base = { id: node.id, kind: node.type, x, y, w, h, tags: [...node.data.tags] }
    switch (node.type) {
      case 'sticky':
        return { ...base, title: node.data.title, text: node.data.content, color: node.data.color, url: '', image: null }
      case 'text':
        return { ...base, title: node.data.title, text: node.data.content, color: null, url: '', image: null }
      case 'image': {
        const uri = input.images[node.data.imageId]
        return { ...base, title: node.data.title, text: node.data.description, color: null, url: '', image: uri && SAFE_IMAGE_URI.test(uri) ? uri : null }
      }
      case 'link':
        return { ...base, title: node.data.title, text: node.data.description, color: null, url: SAFE_LINK.test(node.data.url) ? node.data.url : '', image: null }
      case 'video':
        // العارض المستقل بلا شبكة: يُعرض كبطاقة رابط إلى YouTube
        return { ...base, kind: 'link', title: node.data.title, text: '', color: null, url: SAFE_LINK.test(node.data.url) ? node.data.url : '', image: null }
      case 'shape':
        return { ...base, kind: 'text', title: node.data.label, text: '', color: node.data.color, url: '', image: null }
      case 'checklist':
        // يُعرض في العارض المستقل كبطاقة نص: ☑ للمنجز و☐ لغيره
        return {
          ...base,
          kind: 'text',
          title: node.data.title,
          text: node.data.items.map((item) => `${item.done ? '\u2611' : '\u2610'} ${item.text}`).join('\n'),
          color: null,
          url: '',
          image: null,
        }
      case 'group':
        return { ...base, title: node.data.label, text: '', color: node.data.color, url: '', image: null }
    }
  })

  const known = new Set(nodes.map((node) => node.id))
  const edges = input.edges
    .filter((edge) => known.has(edge.source) && known.has(edge.target))
    .map(
      (edge): ViewerEdge => ({
        from: edge.source,
        to: edge.target,
        fromSide: (edge.sourceHandle as HandleSide | null | undefined) ?? 'right',
        toSide: (edge.targetHandle as HandleSide | null | undefined) ?? 'left',
        label: edge.data?.label ?? '',
        color: edge.data?.color ?? 'gradient',
        curve: edge.data?.curve ?? 'curved',
        line: edge.data?.lineStyle ?? 'solid',
        arrow: edge.data?.arrow ?? 'end',
      }),
    )

  return { name: input.name, description: input.description, exportedAt: input.exportedAt, nodes, edges }
}

/**
 * JSON آمن للدمج داخل <script>: يُهرَّب `<` (فلا يمكن كتابة </script> ولا <!--) و`&` وفواصل الأسطر الخاصة U+2028/2029.
 * هذا هو الحاجز الوحيد بين نص المستخدم وبنية الصفحة، فله اختبارات خاصة.
 */
export function escapeJsonForScript(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029')
}

/** ألوان اللصقات في السمتين (نسخة من index.css: الملف المستقل لا يرى أنماط التطبيق). */
const STICKY_PALETTE_CSS = `
:root{--yellow-bg:#4c4438;--yellow-bd:#d9b985;--yellow-ink:#fbf6ea;--blue-bg:#343c50;--blue-bd:#8fa4d9;--blue-ink:#f1f4ff;--green-bg:#2f4a40;--green-bd:#7fc8a0;--green-ink:#effaf3;--pink-bg:#503848;--pink-bd:#e59ab8;--pink-ink:#fff0f6;--purple-bg:#5f4287;--purple-bd:#c3a0ee;--purple-ink:#fff;--neutral-bg:#26262a;--neutral-bd:#4d4d56;--neutral-ink:#f4f4f5}
:root[data-theme=light]{--yellow-bg:#fcf8b0;--yellow-bd:#ece58f;--yellow-ink:#1e1e1e;--blue-bg:#c6e0f7;--blue-bd:#a9cbea;--blue-ink:#1e1e1e;--green-bg:#d3efb6;--green-bd:#b5db93;--green-ink:#1e1e1e;--pink-bg:#f3b8d2;--pink-bd:#e49bbd;--pink-ink:#1e1e1e;--purple-bg:#c4a3d0;--purple-bd:#ab85ba;--purple-ink:#1e1e1e;--neutral-bg:#ececef;--neutral-bd:#d5d5db;--neutral-ink:#1e1e1e}`

const PAGE_CSS = `
:root{--bg:#0a0a0b;--surface:#111113;--line:#28282d;--text:#f4f4f5;--muted:#8f8f99;--accent:#a78bfa;color-scheme:dark}
:root[data-theme=light]{--bg:#f2f2f2;--surface:#fff;--line:#d5d5db;--text:#111113;--muted:#5f5f69;--accent:#6a43f0;color-scheme:light}
*{box-sizing:border-box}html,body{height:100%;margin:0}
body{background:var(--bg);color:var(--text);font:15px/1.45 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;overflow:hidden}
header{position:fixed;inset:0 0 auto 0;z-index:5;display:flex;gap:8px;align-items:center;padding:10px 12px;pointer-events:none}
header>*{pointer-events:auto}
h1{margin:0;font-size:15px;font-weight:650;padding:7px 14px;border:1px solid var(--line);border-radius:999px;background:var(--surface);max-width:55vw;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.bar{margin-left:auto;display:flex;gap:4px;padding:3px;border:1px solid var(--line);border-radius:999px;background:var(--surface)}
button{font:inherit;color:var(--text);background:none;border:0;border-radius:999px;min-width:36px;height:34px;padding:0 10px;cursor:pointer}
button:hover,button:focus-visible{background:color-mix(in oklab,var(--text) 12%,transparent);outline:none}
#view{position:fixed;inset:0;cursor:grab;touch-action:none}
#view.drag{cursor:grabbing}
#stage{position:absolute;left:0;top:0;transform-origin:0 0}
svg{position:absolute;left:0;top:0;overflow:visible;pointer-events:none}
.card{position:absolute;border-radius:12px;padding:12px 14px;overflow:hidden;border:1px solid var(--line);background:var(--surface)}
.card h2{margin:0 0 4px;font-size:16px;font-weight:650;overflow-wrap:anywhere}
.card p{margin:0;white-space:pre-wrap;overflow-wrap:anywhere}
.card.sticky{background:var(--bg-c);border-color:var(--bd-c);color:var(--ink-c);box-shadow:0 10px 26px -14px #000a}
.card.group{background:color-mix(in oklab,var(--bd-c) 9%,transparent);border:1.5px dashed color-mix(in oklab,var(--bd-c) 60%,transparent);padding:0}
.card.group h2{padding:9px 14px;font-size:14px;color:color-mix(in oklab,var(--bd-c) 55%,var(--text))}
.card.image{padding:8px;display:flex;flex-direction:column;gap:6px}
.card.image img{flex:1;min-height:0;width:100%;object-fit:contain;border-radius:8px}
.card a{color:var(--accent);overflow-wrap:anywhere}
.tags{margin-top:8px;display:flex;flex-wrap:wrap;gap:4px}.tags span{font-size:11.5px;padding:1px 9px;border-radius:999px;background:color-mix(in oklab,currentColor 14%,transparent)}
.elabel{font-size:12px;fill:var(--text)}
footer{position:fixed;left:12px;bottom:10px;font-size:12px;color:var(--muted)}`

/** عارض صغير بلا اعتماديات: سحب للتحريك، عجلة/قرص للتكبير، لوحة مفاتيح، ورسم الوصلات بـ SVG. */
const VIEWER_JS = `
(function(){
var D=JSON.parse(document.getElementById('data').textContent);
var NS='http://www.w3.org/2000/svg',view=document.getElementById('view'),stage=document.getElementById('stage');
var COLORS={gradient:'#a78bfa',violet:'#a78bfa',pink:'#f472b6',blue:'#60a5fa',green:'#4ade80',amber:'#fbbf24',neutral:'#8f8f99'};
var byId={},t={x:0,y:0,k:1};
function el(tag,cls,text){var e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e}
D.nodes.forEach(function(n){
 var c=el('div','card '+n.kind);c.style.left=n.x+'px';c.style.top=n.y+'px';c.style.width=n.w+'px';c.style.height=n.h+'px';
 if(n.color){c.style.setProperty('--bg-c','var(--'+n.color+'-bg)');c.style.setProperty('--bd-c','var(--'+n.color+'-bd)');c.style.setProperty('--ink-c','var(--'+n.color+'-ink)')}
 c.setAttribute('dir','auto');
 if(n.kind==='image'&&n.image){var im=el('img');im.src=n.image;im.alt=n.title||'';c.appendChild(im)}
 if(n.title)c.appendChild(el('h2','',n.title));
 if(n.text)c.appendChild(el('p','',n.text));
 if(n.url){var p=el('p'),a=el('a','',n.url);a.href=n.url;a.target='_blank';a.rel='noopener noreferrer';p.appendChild(a);c.appendChild(p)}
 if(n.tags.length){var g=el('div','tags');n.tags.forEach(function(x){g.appendChild(el('span','',x))});c.appendChild(g)}
 stage.appendChild(c);byId[n.id]=n});
var svg=document.createElementNS(NS,'svg');stage.insertBefore(svg,stage.firstChild);
var defs=document.createElementNS(NS,'defs');svg.appendChild(defs);
Object.keys(COLORS).forEach(function(k){var m=document.createElementNS(NS,'marker');m.setAttribute('id','a-'+k);m.setAttribute('viewBox','0 0 10 10');m.setAttribute('refX','9');m.setAttribute('refY','5');m.setAttribute('markerWidth','8');m.setAttribute('markerHeight','8');m.setAttribute('orient','auto-start-reverse');var pa=document.createElementNS(NS,'path');pa.setAttribute('d','M0 0L10 5L0 10z');pa.setAttribute('fill',COLORS[k]);m.appendChild(pa);defs.appendChild(m)});
function pt(n,s){return s==='top'?[n.x+n.w/2,n.y]:s==='bottom'?[n.x+n.w/2,n.y+n.h]:s==='left'?[n.x,n.y+n.h/2]:[n.x+n.w,n.y+n.h/2]}
function dir(s){return s==='top'?[0,-1]:s==='bottom'?[0,1]:s==='left'?[-1,0]:[1,0]}
D.edges.forEach(function(e){
 var a=byId[e.from],b=byId[e.to];if(!a||!b)return;
 var p=pt(a,e.fromSide),q=pt(b,e.toSide),da=dir(e.fromSide),db=dir(e.toSide),d;
 if(e.curve==='straight')d='M'+p+'L'+q;
 else if(e.curve==='step'){var mx=(p[0]+q[0])/2;d='M'+p+'L'+mx+','+p[1]+'L'+mx+','+q[1]+'L'+q}
 else{var o=Math.max(60,Math.hypot(q[0]-p[0],q[1]-p[1])/3);d='M'+p+'C'+(p[0]+da[0]*o)+','+(p[1]+da[1]*o)+' '+(q[0]+db[0]*o)+','+(q[1]+db[1]*o)+' '+q}
 var path=document.createElementNS(NS,'path');path.setAttribute('d',d);path.setAttribute('fill','none');path.setAttribute('stroke',COLORS[e.color]||COLORS.violet);path.setAttribute('stroke-width','2');
 if(e.line==='dashed')path.setAttribute('stroke-dasharray','8 6');if(e.line==='dotted')path.setAttribute('stroke-dasharray','2 6');
 var id='a-'+(COLORS[e.color]?e.color:'violet');
 if(e.arrow==='end'||e.arrow==='both')path.setAttribute('marker-end','url(#'+id+')');
 if(e.arrow==='start'||e.arrow==='both')path.setAttribute('marker-start','url(#'+id+')');
 svg.appendChild(path);
 if(e.label){var tx=document.createElementNS(NS,'text');tx.setAttribute('x',(p[0]+q[0])/2);tx.setAttribute('y',(p[1]+q[1])/2-6);tx.setAttribute('text-anchor','middle');tx.setAttribute('class','elabel');tx.textContent=e.label;svg.appendChild(tx)}});
function apply(){stage.style.transform='translate('+t.x+'px,'+t.y+'px) scale('+t.k+')'}
function zoomAt(f,cx,cy){var k=Math.min(4,Math.max(0.05,t.k*f));f=k/t.k;t.x=cx-(cx-t.x)*f;t.y=cy-(cy-t.y)*f;t.k=k;apply()}
function fit(){
 if(!D.nodes.length){t={x:0,y:0,k:1};apply();return}
 var x1=1/0,y1=1/0,x2=-1/0,y2=-1/0;D.nodes.forEach(function(n){x1=Math.min(x1,n.x);y1=Math.min(y1,n.y);x2=Math.max(x2,n.x+n.w);y2=Math.max(y2,n.y+n.h)});
 var W=innerWidth,H=innerHeight,pad=70,k=Math.min(1.25,Math.max(0.05,Math.min((W-pad*2)/(x2-x1),(H-pad*2)/(y2-y1))));
 t.k=k;t.x=(W-(x2-x1)*k)/2-x1*k;t.y=(H-(y2-y1)*k)/2-y1*k+16;apply()}
var ptrs={},last=null;
view.addEventListener('pointerdown',function(e){if(e.target.closest('a'))return;view.setPointerCapture(e.pointerId);ptrs[e.pointerId]=[e.clientX,e.clientY];view.classList.add('drag')});
view.addEventListener('pointermove',function(e){var p=ptrs[e.pointerId];if(!p)return;var ids=Object.keys(ptrs);
 if(ids.length===2){var o=ids[0]==e.pointerId?ids[1]:ids[0],po=ptrs[o],d0=Math.hypot(p[0]-po[0],p[1]-po[1]);ptrs[e.pointerId]=[e.clientX,e.clientY];var d1=Math.hypot(e.clientX-po[0],e.clientY-po[1]);if(d0>0)zoomAt(d1/d0,(e.clientX+po[0])/2,(e.clientY+po[1])/2);return}
 t.x+=e.clientX-p[0];t.y+=e.clientY-p[1];ptrs[e.pointerId]=[e.clientX,e.clientY];apply()});
function up(e){delete ptrs[e.pointerId];if(!Object.keys(ptrs).length)view.classList.remove('drag')}
view.addEventListener('pointerup',up);view.addEventListener('pointercancel',up);
view.addEventListener('wheel',function(e){e.preventDefault();zoomAt(Math.exp(-e.deltaY*(e.ctrlKey?0.01:0.0015)),e.clientX,e.clientY)},{passive:false});
document.getElementById('fit').onclick=fit;
document.getElementById('in').onclick=function(){zoomAt(1.25,innerWidth/2,innerHeight/2)};
document.getElementById('out').onclick=function(){zoomAt(0.8,innerWidth/2,innerHeight/2)};
var root=document.documentElement;
document.getElementById('theme').onclick=function(){root.setAttribute('data-theme',root.getAttribute('data-theme')==='light'?'dark':'light')};
addEventListener('keydown',function(e){if(e.key==='+'||e.key==='=')zoomAt(1.25,innerWidth/2,innerHeight/2);else if(e.key==='-')zoomAt(0.8,innerWidth/2,innerHeight/2);else if(e.key==='0')fit();else if(e.key.indexOf('Arrow')===0){var s=60;if(e.key==='ArrowLeft')t.x+=s;if(e.key==='ArrowRight')t.x-=s;if(e.key==='ArrowUp')t.y+=s;if(e.key==='ArrowDown')t.y-=s;apply();e.preventDefault()}});
addEventListener('resize',fit);
if(matchMedia&&matchMedia('(prefers-color-scheme: light)').matches)root.setAttribute('data-theme','light');
fit();
})();`

/** عنوان الصفحة وأسماء المساحات تُهرَّب كنص HTML (تظهر في <title> خارج JSON). */
export function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

export function buildViewerHtml(data: ViewerData): string {
  const title = escapeHtml(data.name || 'InfiniteSpace workspace')
  const exported = new Date(data.exportedAt).toISOString().slice(0, 10)
  return `<!doctype html>
<html lang="en" data-theme="dark">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'; script-src 'unsafe-inline'; base-uri 'none'; form-action 'none'">
<title>${title}</title>
<style>${STICKY_PALETTE_CSS}${PAGE_CSS}</style>
</head>
<body>
<header>
<h1 dir="auto">${title}</h1>
<div class="bar" role="toolbar" aria-label="View">
<button id="out" aria-label="Zoom out" title="Zoom out (-)">−</button>
<button id="fit" aria-label="Fit all content" title="Fit all content (0)">Fit</button>
<button id="in" aria-label="Zoom in" title="Zoom in (+)">+</button>
<button id="theme" aria-label="Switch light or dark theme" title="Switch theme">◐</button>
</div>
</header>
<div id="view" tabindex="0" aria-label="Read-only canvas. Drag to move, scroll or pinch to zoom."><div id="stage"></div></div>
<footer>Read-only copy · exported ${exported} from InfiniteSpace</footer>
<script id="data" type="application/json">${escapeJsonForScript(data)}</script>
<script>${VIEWER_JS}</script>
</body>
</html>
`
}
