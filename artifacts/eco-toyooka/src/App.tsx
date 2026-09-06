import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode, type WheelEvent } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ClerkProvider, SignIn, SignUp, useAuth, useClerk, useUser } from '@clerk/react';
import { publishableKeyFromHost } from '@clerk/react/internal';
import { shadcn } from '@clerk/themes';
import { Redirect, Route, Router as WouterRouter, Switch, useLocation } from 'wouter';
import {
  ArrowLeft, ArrowRight, Bell, Bird, Building2, Check, ChevronDown,
  CircleHelp, Coins, Footprints, Home as HomeIcon, Leaf, Map, Minus,
  Plus, Recycle, RotateCcw, ShoppingBag, Sparkles, Store, Trees, Trophy,
  Waves, X, Zap,
} from 'lucide-react';

type View = 'home' | 'actions' | 'reward' | 'town' | 'shop' | 'map';
type DistrictId = 'toyooka' | 'kinosaki' | 'takeno' | 'hidaka' | 'izushi' | 'tantou';
type ActionId = 'my-bag' | 'my-bottle' | 'pet-bottle' | 'plastic' | 'sort' | 'walk' | 'transport' | 'clean';

type ActionLog = { id: string; title: string; date: string; coins: number; exp: number };
type GameState = {
  district: DistrictId;
  level: number;
  exp: number;
  coins: number;
  purchased: string[];
  placed: string[];
  history: ActionLog[];
};

const queryClient = new QueryClient();
const STORAGE_KEY = 'eco-toyooka-game-v3';
const clerkPubKey = publishableKeyFromHost(window.location.hostname, import.meta.env.VITE_CLERK_PUBLISHABLE_KEY);
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');

function stripBase(path: string) {
  return basePath && path.startsWith(basePath) ? path.slice(basePath.length) || '/' : path;
}

const clerkAppearance = {
  theme: shadcn,
  cssLayerName: 'clerk',
  options: {
    logoPlacement: 'inside' as const,
    logoLinkUrl: basePath || '/',
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
  },
  variables: {
    colorPrimary: '#4ca061',
    colorForeground: '#355d49',
    colorMutedForeground: '#7c8b7d',
    colorDanger: '#c86558',
    colorBackground: '#fffef8',
    colorInput: '#fbfcf4',
    colorInputForeground: '#355d49',
    colorNeutral: '#d9e1d1',
    fontFamily: "'Zen Kaku Gothic New', sans-serif",
    borderRadius: '1rem',
  },
  elements: {
    rootBox: 'w-full flex justify-center',
    cardBox: 'bg-[#fffef8] rounded-2xl w-[420px] max-w-full overflow-hidden shadow-xl',
    card: '!shadow-none !border-0 !bg-transparent !rounded-none',
    footer: '!shadow-none !border-0 !bg-transparent !rounded-none',
    headerTitle: 'text-[#355d49] font-black',
    headerSubtitle: 'text-[#7c8b7d]',
    socialButtonsBlockButtonText: 'text-[#355d49] font-bold',
    formFieldLabel: 'text-[#52705b] font-bold',
    footerActionLink: 'text-[#3f8b55] font-bold',
    footerActionText: 'text-[#7c8b7d]',
    dividerText: 'text-[#8b9789]',
    formButtonPrimary: 'bg-[#4ca061] hover:bg-[#3d8d52] text-white font-black',
    formFieldInput: 'bg-[#fbfcf4] border-[#d9e1d1] text-[#355d49]',
    socialButtonsBlockButton: 'border-[#d9e1d1] bg-white',
    main: 'bg-transparent',
  },
};
const defaultState: GameState = {
  district: 'izushi',
  level: 1,
  exp: 0,
  coins: 0,
  purchased: [],
  placed: [],
  history: [],
};

const districts: {
  id: DistrictId;
  name: string;
  blurb: string;
  color: string;
  path: string;
  x: number;
  y: number;
  icon: 'mountain' | 'castle' | 'wave' | 'bird' | 'house';
}[] = [
  { id: 'kinosaki', name: '城崎', blurb: '歴史ある温泉街と自然が調和するまち', color: '#c8dc83', path: 'M270 72 C303 50 356 46 385 67 L395 113 C380 137 348 143 315 130 L274 145 L247 113 Z', x: 320, y: 95, icon: 'wave' },
  { id: 'takeno', name: '竹野', blurb: '海と山に囲まれた、風の気持ちいいまち', color: '#b6db9e', path: 'M122 140 C143 118 183 112 214 125 L251 157 L226 202 L182 211 L138 190 L108 168 Z', x: 171, y: 164, icon: 'wave' },
  { id: 'toyooka', name: '豊岡', blurb: 'コウノトリが舞う、豊岡市の中心のまち', color: '#a5d57d', path: 'M257 141 C289 123 335 126 366 142 L405 182 L382 237 L344 263 L296 244 L253 263 L222 218 L224 178 Z', x: 313, y: 194, icon: 'bird' },
  { id: 'hidaka', name: '日高', blurb: '山と田園が広がる、自然豊かなまち', color: '#91ca79', path: 'M93 234 C123 211 170 215 214 232 L253 268 L235 320 L191 342 L136 329 L98 299 L68 264 Z', x: 156, y: 276, icon: 'mountain' },
  { id: 'izushi', name: '出石', blurb: '歴史ある城下町と自然が調和するまち', color: '#d4df83', path: 'M260 271 C290 250 334 257 366 270 L410 309 L399 360 L357 386 L302 376 L268 350 L234 312 Z', x: 320, y: 317, icon: 'castle' },
  { id: 'tantou', name: '但東', blurb: '里山と花に出会える、のどかなまち', color: '#bdd77b', path: 'M416 258 C446 236 484 237 517 257 L548 296 L536 346 L494 371 L449 355 L416 320 L391 291 Z', x: 478, y: 298, icon: 'house' },
];

const shopItems = [
  { id: 'castle', name: '出石城', note: '歴史の景色を守る場所', cost: 500, Icon: Building2, tone: '#8c7556' },
  { id: 'park', name: '公園', note: 'みんなが集まる場所', cost: 300, Icon: Trees, tone: '#69a85f' },
  { id: 'shop', name: 'お店', note: 'にぎやかな商いのまち', cost: 200, Icon: Store, tone: '#bd805c' },
  { id: 'house', name: '新しい住宅', note: '暮らしやすいまちに', cost: 150, Icon: HomeIcon, tone: '#d0836f' },
  { id: 'bridge', name: '橋', note: 'まちをつなぐ橋', cost: 250, Icon: Waves, tone: '#5d9e9e' },
];

const actionOptions: {
  id: ActionId;
  title: string;
  detail: string;
  Icon: typeof Leaf;
  tone: string;
  exp: number;
  coins: number;
}[] = [
  { id: 'my-bag', title: 'マイバッグを使った', detail: '買い物袋を減らした', Icon: ShoppingBag, tone: '#65a870', exp: 10, coins: 40 },
  { id: 'my-bottle', title: 'マイボトルを使った', detail: '飲み物を持ち歩いた', Icon: Recycle, tone: '#5da2a1', exp: 10, coins: 40 },
  { id: 'pet-bottle', title: 'ペットボトルを減らした', detail: '使い捨てを減らした', Icon: Waves, tone: '#6c9eb1', exp: 15, coins: 60 },
  { id: 'plastic', title: 'プラスチックを減らした', detail: 'プラごみを減らした', Icon: Leaf, tone: '#85a861', exp: 15, coins: 60 },
  { id: 'sort', title: 'ごみを分別した', detail: '資源を分けて出した', Icon: Recycle, tone: '#c09a5c', exp: 10, coins: 40 },
  { id: 'walk', title: '徒歩・自転車で移動した', detail: '車を使わず移動した', Icon: Footprints, tone: '#73a66d', exp: 20, coins: 80 },
  { id: 'transport', title: '公共交通機関を利用した', detail: 'バスや電車を使った', Icon: Map, tone: '#668dac', exp: 20, coins: 80 },
  { id: 'clean', title: '地域の清掃をした', detail: 'まちをきれいにした', Icon: Trees, tone: '#b78666', exp: 25, coins: 100 },
];

function readState(): GameState {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null') as Partial<GameState> | null;
    if (!saved || typeof saved !== 'object') return defaultState;
    return {
      district: districts.some((district) => district.id === saved.district) ? saved.district as DistrictId : defaultState.district,
      level: Number.isFinite(saved.level) && Number(saved.level) > 0 ? Number(saved.level) : defaultState.level,
      exp: Number.isFinite(saved.exp) && Number(saved.exp) >= 0 ? Number(saved.exp) : defaultState.exp,
      coins: Number.isFinite(saved.coins) && Number(saved.coins) >= 0 ? Number(saved.coins) : defaultState.coins,
      purchased: Array.isArray(saved.purchased) ? saved.purchased.filter((id): id is string => typeof id === 'string') : [],
      placed: Array.isArray(saved.placed) ? saved.placed.filter((id): id is string => typeof id === 'string') : [],
      history: Array.isArray(saved.history) ? saved.history.slice(0, 30) as ActionLog[] : [],
    };
  } catch {
    return defaultState;
  }
}

function CoinPill({ amount }: { amount: number }) {
  return <span data-testid="text-coin-balance" className="coin-pill"><Coins size={15} strokeWidth={2.6} />{amount.toLocaleString()}</span>;
}

function IconBox({ children, tone = 'green', size = 'md' }: { children: ReactNode; tone?: 'green' | 'gold' | 'blue' | 'orange'; size?: 'sm' | 'md' }) {
  const styles = {
    green: 'icon-box-green',
    gold: 'icon-box-gold',
    blue: 'icon-box-blue',
    orange: 'icon-box-orange',
  };
  return <span className={`icon-box ${styles[tone]} ${size === 'sm' ? 'icon-box-sm' : ''}`}>{children}</span>;
}

function AppHeader({ state, onNavigate }: { state: GameState; onNavigate: (view: View) => void }) {
  const { signOut } = useClerk();
  const { user } = useUser();
  const accountInitial = (user?.firstName?.[0] ?? user?.primaryEmailAddress?.emailAddress?.[0] ?? 'U').toUpperCase();
  return <header className="app-header">
    <button type="button" className="brand-lockup" onClick={() => onNavigate('home')} aria-label="ホームへ">
      <span className="brand-mark"><Leaf size={22} fill="currentColor" /><span className="brand-spark" /></span>
      <span><strong>エコとよおか</strong><small>〜未来の豊岡を育てよう〜</small></span>
    </button>
    <div className="header-actions"><CoinPill amount={state.coins} /><button type="button" className="header-icon" aria-label="お知らせ"><Bell size={18} /></button><button type="button" className="account-button" aria-label="ログアウト" onClick={() => signOut({ redirectUrl: basePath || '/' })}>{accountInitial}</button></div>
  </header>;
}

function BottomNav({ view, onNavigate }: { view: View; onNavigate: (view: View) => void }) {
  const items: { id: View; label: string; Icon: typeof Leaf }[] = [
    { id: 'home', label: 'ホーム', Icon: HomeIcon },
    { id: 'actions', label: '記録', Icon: Leaf },
    { id: 'town', label: '街づくり', Icon: Building2 },
    { id: 'shop', label: 'ショップ', Icon: ShoppingBag },
    { id: 'map', label: '地区変更', Icon: Map },
  ];
  return <nav className="bottom-nav">{items.map(({ id, label, Icon }) => <button key={id} type="button" onClick={() => onNavigate(id)} className={view === id ? 'active' : ''}><Icon size={17} strokeWidth={view === id ? 2.5 : 1.8} /><span>{label}</span></button>)}</nav>;
}

function MapIllustration({ selected, onSelect, onStart, compact = false }: { selected: DistrictId; onSelect: (id: DistrictId) => void; onStart?: () => void; compact?: boolean }) {
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const drag = useRef({ x: 0, y: 0, ox: 0, oy: 0, active: false });
  const handleDown = (event: ReactPointerEvent<SVGSVGElement>) => {
    drag.current = { x: event.clientX, y: event.clientY, ox: offset.x, oy: offset.y, active: true };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const handleMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (!drag.current.active) return;
    setOffset({ x: drag.current.ox + event.clientX - drag.current.x, y: drag.current.oy + event.clientY - drag.current.y });
  };
  const handleWheel = (event: WheelEvent<HTMLElement>) => {
    event.preventDefault();
    setScale((value) => Math.min(1.8, Math.max(.78, value - event.deltaY * .001)));
  };
  const hitAreas: { id: DistrictId; left: string; top: string; width: string; height: string }[] = [
    { id: 'kinosaki', left: '21%', top: '11%', width: '31%', height: '28%' },
    { id: 'takeno', left: '5%', top: '31%', width: '30%', height: '27%' },
    { id: 'toyooka', left: '20%', top: '31%', width: '40%', height: '38%' },
    { id: 'hidaka', left: '5%', top: '59%', width: '31%', height: '28%' },
    { id: 'izushi', left: '32%', top: '59%', width: '31%', height: '29%' },
    { id: 'tantou', left: '56%', top: '57%', width: '34%', height: '31%' },
  ];
  const selectedDistrict = districts.find((district) => district.id === selected) ?? districts[4];
  return <div className={`toyooka-map ${compact ? 'toyooka-map-compact' : ''}`}>
    <div className="reference-map-viewport" onPointerDown={(event) => { drag.current = { x: event.clientX, y: event.clientY, ox: offset.x, oy: offset.y, active: true }; event.currentTarget.setPointerCapture(event.pointerId); }} onPointerMove={(event) => { if (drag.current.active) setOffset({ x: drag.current.ox + event.clientX - drag.current.x, y: drag.current.oy + event.clientY - drag.current.y }); }} onPointerUp={() => { drag.current.active = false; }} onPointerCancel={() => { drag.current.active = false; }} onWheel={handleWheel}>
      <img className="reference-map-image" src={`${import.meta.env.BASE_URL}toyooka-map-reference.png`} alt="豊岡市の6地区を描いたイラストマップ" draggable={false} style={{ transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})` }} />
      <div className="map-hit-layer">{hitAreas.map((area) => { const district = districts.find((item) => item.id === area.id); return <button key={area.id} type="button" aria-label={`${district?.name ?? ''}地区を選択`} className={`map-hit-area ${selected === area.id ? 'selected' : ''}`} style={{ left: area.left, top: area.top, width: area.width, height: area.height }} onPointerDown={(event) => event.stopPropagation()} onClick={() => onSelect(area.id)} />; })}</div>
      <div className="map-action-card" onPointerDown={(event) => event.stopPropagation()}>
        <strong>{selectedDistrict.name}地区</strong>
        <p>{selectedDistrict.blurb}</p>
        <button type="button" onClick={onStart}>この地区で<br />はじめる <ArrowRight size={11} /></button>
      </div>
      <div className="reference-map-controls"><button type="button" aria-label="地図を縮小" onPointerDown={(event) => event.stopPropagation()} onClick={() => setScale((value) => Math.max(.78, value - .12))}><Minus size={15} /></button><button type="button" aria-label="地図をリセット" onPointerDown={(event) => event.stopPropagation()} onClick={() => { setScale(1); setOffset({ x: 0, y: 0 }); }}><RotateCcw size={14} /></button><button type="button" aria-label="地図を拡大" onPointerDown={(event) => event.stopPropagation()} onClick={() => setScale((value) => Math.min(1.8, value + .12))}><Plus size={15} /></button></div>
    </div>
  </div>;
}

function TownScene({ state, compact = false }: { state: GameState; compact?: boolean }) {
  const placedItems = state.placed.map((id) => shopItems.find((item) => item.id === id)).filter(Boolean);
  return <div className={`town-scene ${compact ? 'town-scene-compact' : ''}`}>
    <div className="town-hills" /><div className="town-river" />
    <div className="town-house house-one"><HomeIcon size={compact ? 34 : 55} fill="#e2a06b" /></div>
    <div className="town-tree tree-one"><Trees size={compact ? 40 : 58} fill="#6fa767" /></div>
    <div className="town-tree tree-two"><Trees size={compact ? 34 : 48} fill="#76ae6c" /></div>
    <div className="town-castle"><Building2 size={compact ? 43 : 62} fill="#eee0bc" /></div>
    <div className="town-bridge"><Waves size={compact ? 32 : 45} /></div>
    {placedItems.map((item, index) => item && <div key={`${item.id}-${index}`} className="placed-item" style={{ left: `${16 + (index % 3) * 29}%`, top: `${22 + (index % 2) * 25}%` }}><span style={{ color: item.tone }}><item.Icon size={compact ? 25 : 34} /></span></div>)}
    {placedItems.length === 0 && <span className="town-empty">環境行動で、まちが育ちます</span>}
    <span className="town-label">出石地区のまち</span>
  </div>;
}

function TownProgressStrip({ state, districtName, full = false, showTitle = true }: { state: GameState; districtName: string; full?: boolean; showTitle?: boolean }) {
  const progress = Math.min(4, state.placed.length);
  const stageLabels = ['はじめのまち', '公園を配置', 'お店を配置', 'お城と橋を配置', '発展しました'];
  const progressPercent = Math.min(100, 25 + progress * 19);
  return <section className={`town-reference-card ${full ? 'town-reference-card-full' : ''}`}>
    <div className="town-reference-viewport">
      <img src={`${import.meta.env.BASE_URL}town-progress-reference.png`} alt={`${districtName}地区の街づくりの発展イメージ`} />
      <div className={`town-reference-title ${showTitle ? '' : 'town-reference-title-blank'}`}>{showTitle ? `街づくり（${districtName}地区の例）` : ''}</div>
    </div>
    <div className="town-reference-status"><span>現在のまち：{stageLabels[progress]}</span><strong>{progressPercent}%</strong></div>
  </section>;
}

function LevelCard({ state }: { state: GameState }) {
  const goal = 1000;
  const percent = Math.min(100, Math.round((state.exp / goal) * 100));
  return <section className="level-card"><div className="level-row"><strong>Lv. {state.level}</strong><span>{state.exp} / {goal} EXP</span></div><div className="level-bar"><span style={{ width: `${percent}%` }} /></div></section>;
}

function DistrictCard({ district, onChange }: { district: typeof districts[number]; onChange: () => void }) {
  return <button type="button" className="district-chip" onClick={onChange}><Map size={14} /><span>{district.name}地区</span><ChevronDown size={14} /></button>;
}

function HomeView({ state, onNavigate, onSelectDistrict }: { state: GameState; onNavigate: (view: View) => void; onSelectDistrict: (id: DistrictId) => void }) {
  const district = districts.find((item) => item.id === state.district) ?? districts[4];
  return <main className="mobile-page home-page">
    <section className="home-map-card">
      <MapIllustration selected={state.district} onSelect={onSelectDistrict} onStart={() => onNavigate('home')} compact />
      <div className="map-selected-card"><div><strong>{district.name}地区</strong><p>{district.blurb}</p></div><button type="button" onClick={() => onNavigate('map')} aria-label="地区を変更"><ArrowRight size={16} /></button></div>
    </section>
    <section className="profile-strip"><DistrictCard district={district} onChange={() => onNavigate('map')} /><div className="profile-stats"><div><span>環境レベル</span><strong>Lv. {state.level}</strong></div><div className="profile-divider" /><div><span>所持コイン</span><strong className="coin-number"><Coins size={14} />{state.coins.toLocaleString()}</strong></div></div></section>
    <LevelCard state={state} />
    <section className="town-card progression-card"><div className="section-heading"><div><small>MY TOYOOKA</small><h2>自分の豊岡</h2></div><button type="button" onClick={() => onNavigate('town')} aria-label="街を見る"><ArrowRight size={18} /></button></div><TownProgressStrip state={state} districtName={district.name} showTitle={false} /></section>
    <button type="button" className="primary-action" onClick={() => onNavigate('actions')}><Leaf size={19} />行動を記録する</button>
    <button type="button" className="secondary-action" onClick={() => onNavigate('shop')}><ShoppingBag size={17} />ショップ</button>
    <section className="history-card"><div className="section-heading"><div><small>YOUR RECORDS</small><h2>最近の記録</h2></div><button type="button" onClick={() => onNavigate('actions')}>すべて見る</button></div>{state.history.length ? state.history.slice(0, 2).map((log) => <div key={log.id} className="history-row"><span className="history-check"><Check size={13} /></span><span>{log.title}</span><strong>+{log.coins}</strong></div>) : <p className="empty-history">今日の小さな行動を記録してみよう</p>}</section>
  </main>;
}

function MapView({ state, onSelect, onStart }: { state: GameState; onSelect: (id: DistrictId) => void; onStart: () => void }) {
  const district = districts.find((item) => item.id === state.district) ?? districts[4];
  return <main className="mobile-page map-page"><div className="screen-title"><button type="button" onClick={onStart} aria-label="ホームへ"><ArrowLeft size={18} /></button><div><small>地区を選ぶ</small><h1>豊岡市マップ</h1></div><CircleHelp size={17} /></div><MapIllustration selected={state.district} onSelect={onSelect} onStart={onStart} /><section className="district-detail"><span className="eyebrow">SELECTED DISTRICT</span><div className="district-detail-row"><div><h2>{district.name}地区</h2><p>{district.blurb}</p></div><IconBox tone="green"><Map size={22} /></IconBox></div><button type="button" className="primary-action" onClick={onStart}>この地区で街づくりを始める <ArrowRight size={17} /></button></section></main>;
}

function ActionsView({ onReward, onNavigate }: { onReward: (result: { coins: number; exp: number; levelUp: boolean; title: string }) => void; onNavigate: (view: View) => void }) {
  const [selected, setSelected] = useState<ActionId[]>([]);
  const [plastic, setPlastic] = useState({ large: 0, medium: 0, small: 0 });
  const [error, setError] = useState('');
  const submit = () => {
    if (!selected.length) { setError('行った環境行動をひとつ選んでください'); return; }
    const selectedActions = actionOptions.filter((action) => selected.includes(action.id));
    const extraExp = selected.includes('plastic') ? plastic.large * 5 + plastic.medium * 3 + plastic.small : 0;
    const extraCoins = selected.includes('plastic') ? plastic.large * 10 + plastic.medium * 6 + plastic.small * 2 : 0;
    const exp = selectedActions.reduce((sum, item) => sum + item.exp, 0) + extraExp;
    const coins = selectedActions.reduce((sum, item) => sum + item.coins, 0) + extraCoins;
    onReward({ coins, exp, levelUp: false, title: selected.length === 1 ? selectedActions[0].title : `${selected.length}つの環境行動` });
  };
  const changePlastic = (key: keyof typeof plastic, amount: number) => setPlastic((current) => ({ ...current, [key]: Math.max(0, current[key] + amount) }));
  return <main className="mobile-page actions-page"><div className="screen-title"><button type="button" onClick={() => onNavigate('home')} aria-label="ホームへ"><ArrowLeft size={18} /></button><div><small>環境行動</small><h1>行動を記録する</h1></div><CircleHelp size={17} /></div><p className="screen-lead">今日できた環境行動を選んで、まちにコインを届けよう！</p><section className="action-grid">{actionOptions.map(({ id, title, Icon, tone }) => { const active = selected.includes(id); return <button key={id} type="button" className={`action-card ${active ? 'selected' : ''}`} onClick={() => { setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]); setError(''); }}><IconBox size="sm" tone={id === 'my-bottle' || id === 'pet-bottle' ? 'blue' : id === 'sort' ? 'gold' : id === 'clean' ? 'orange' : 'green'}><Icon size={17} style={{ color: tone }} /></IconBox><span>{title}</span>{active && <i><Check size={11} /></i>}</button>; })}</section><section className="waste-card"><div className="section-heading"><div><small>今日のプラごみ発生量</small><h2>減らせた量を入力</h2></div><CircleHelp size={15} /></div><div className="waste-inputs">{(['large', 'medium', 'small'] as const).map((key, index) => <div key={key} className="waste-control"><span>{['大', '中', '小'][index]}</span><div><button type="button" onClick={() => changePlastic(key, -1)} aria-label={`${key}を減らす`}><Minus size={13} /></button><b>{plastic[key]}</b><button type="button" onClick={() => changePlastic(key, 1)} aria-label={`${key}を増やす`}><Plus size={13} /></button></div></div>)}</div></section>{error && <p className="form-error">{error}</p>}<button type="button" className="primary-action" onClick={submit}>データを送信する <ArrowRight size={17} /></button></main>;
}

function RewardView({ result, state, onNavigate }: { result: { coins: number; exp: number; levelUp: boolean; title: string }; state: GameState; onNavigate: (view: View) => void }) {
  const district = districts.find((item) => item.id === state.district) ?? districts[4];
  return <main className="mobile-page reward-page"><div className="screen-title"><button type="button" onClick={() => onNavigate('actions')} aria-label="記録へ戻る"><ArrowLeft size={18} /></button><div><small>環境行動の判定</small><h1>判定結果</h1></div><Sparkles size={17} className="gold-icon" /></div><section className="reward-hero"><div className="reward-art"><Bird size={78} fill="#fbfbf1" strokeWidth={1.5} /><Building2 size={56} fill="#e8dfc1" strokeWidth={1.4} /><span className="sparkle-dot dot-one">✦</span><span className="sparkle-dot dot-two">✦</span></div><h2>素晴らしい行動です！</h2><p>{result.title}を記録しました</p></section><section className="reward-card"><div className="reward-card-title">今回の環境貢献度</div><strong>+{result.exp} <small>EXP</small></strong><div className="reward-divider" /><div className="reward-stats"><div><span>獲得コイン</span><b><Coins size={14} />+{result.coins}</b></div><div><span>環境レベル</span><b>Lv.{state.level}</b></div></div></section><section className="district-fact"><span className="eyebrow">{district.name}地区の魅力</span><p>{district.blurb}</p></section><button type="button" className="primary-action" onClick={() => onNavigate('town')}>街を見る <ArrowRight size={17} /></button></main>;
}

function TownView({ state, onNavigate }: { state: GameState; onNavigate: (view: View) => void }) {
  const district = districts.find((item) => item.id === state.district) ?? districts[4];
  return <main className="mobile-page town-page"><div className="screen-title"><button type="button" onClick={() => onNavigate('home')} aria-label="ホームへ"><ArrowLeft size={18} /></button><div><small>街づくり</small><h1>自分の豊岡</h1></div><CoinPill amount={state.coins} /></div><TownProgressStrip state={state} districtName={district.name} full /><section className="town-detail-card"><span className="eyebrow">{district.name}地区の街づくり</span><h2>小さな行動が、まちを育てます</h2><p>{district.blurb}</p></section><button type="button" className="primary-action" onClick={() => onNavigate('shop')}><ShoppingBag size={17} />ショップで街を発展させる</button></main>;
}

function ShopView({ state, onPurchase, onNavigate }: { state: GameState; onPurchase: (id: string) => boolean; onNavigate: (view: View) => void }) {
  const [message, setMessage] = useState('');
  const buy = (id: string) => { const item = shopItems.find((entry) => entry.id === id); if (!item) return; const success = onPurchase(id); setMessage(success ? `${item.name}を街に配置しました` : state.purchased.includes(id) ? 'このアイテムは購入済みです' : 'コインが足りません。行動して集めよう'); };
  return <main className="mobile-page shop-page"><div className="screen-title"><button type="button" onClick={() => onNavigate('home')} aria-label="ホームへ"><ArrowLeft size={18} /></button><div><small>街を発展させる</small><h1>ショップ</h1></div><CoinPill amount={state.coins} /></div><div className="shop-tabs"><button className="active">建物</button><button>自然</button><button>その他</button></div>{message && <p className="purchase-message"><Check size={14} />{message}</p>}<section className="shop-list">{shopItems.map((item) => { const owned = state.purchased.includes(item.id); return <div className="shop-row" key={item.id}><span className="shop-art" style={{ color: item.tone }}><item.Icon size={32} /></span><div className="shop-copy"><strong>{item.name}</strong><small>{item.note}</small><b><Coins size={12} />{item.cost}</b></div><button type="button" disabled={owned} onClick={() => buy(item.id)}>{owned ? '購入済み' : '購入＆配置'}</button></div>; })}</section><section className="shop-footer-art"><Trees size={42} /><Building2 size={42} /><Store size={39} /><Trees size={46} /></section></main>;
}

function AppContent() {
  const [state, setState] = useState<GameState>(readState);
  const [view, setView] = useState<View>('home');
  const [result, setResult] = useState({ coins: 0, exp: 0, levelUp: false, title: '' });
  useEffect(() => { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* localStorage is optional in private browsing */ } }, [state]);
  const navigate = (next: View) => { setView(next); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const chooseDistrict = (id: DistrictId) => setState((current) => ({ ...current, district: id }));
  const completeAction = (reward: { coins: number; exp: number; levelUp: boolean; title: string }) => {
    setState((current) => {
      const goal = current.level >= 5 ? 1000 : 100 + (current.level - 1) * 75;
      const nextExp = current.exp + reward.exp;
      const leveled = nextExp >= goal;
      return { ...current, coins: current.coins + reward.coins, exp: leveled ? nextExp - goal : nextExp, level: leveled ? current.level + 1 : current.level, history: [{ id: `${Date.now()}`, title: reward.title, date: new Date().toLocaleDateString('ja-JP'), coins: reward.coins, exp: reward.exp }, ...current.history].slice(0, 30) };
    });
    setResult(reward);
    navigate('reward');
  };
  const purchase = (id: string) => {
    const item = shopItems.find((entry) => entry.id === id);
    if (!item || state.coins < item.cost || state.purchased.includes(id)) return false;
    setState((current) => ({ ...current, coins: current.coins - item.cost, purchased: [...current.purchased, id], placed: [...current.placed, id] }));
    return true;
  };
  return <div className="app-shell"><div className="grain" /><AppHeader state={state} onNavigate={navigate} />{view === 'home' && <HomeView state={state} onNavigate={navigate} onSelectDistrict={chooseDistrict} />}{view === 'map' && <MapView state={state} onSelect={chooseDistrict} onStart={() => navigate('home')} />}{view === 'actions' && <ActionsView onReward={completeAction} onNavigate={navigate} />}{view === 'reward' && <RewardView result={result} state={state} onNavigate={navigate} />}{view === 'town' && <TownView state={state} onNavigate={navigate} />}{view === 'shop' && <ShopView state={state} onPurchase={purchase} onNavigate={navigate} />}<BottomNav view={view} onNavigate={navigate} /></div>;
}

function AuthLanding() {
  return <main className="auth-landing">
    <div className="auth-landing-mark"><Leaf size={30} fill="currentColor" /><span>エコとよおか</span><small>〜未来の豊岡を育てよう〜</small></div>
    <div className="auth-landing-card">
      <span className="eyebrow">TOYOOKA ECO ACTION</span>
      <h1>環境にやさしい行動で<br />自分だけの豊岡をつくろう！</h1>
      <p>毎日の小さな行動を記録してコインを集め、あなたの街を育てます。</p>
      <div className="auth-landing-actions"><a className="auth-primary" href={`${basePath}/sign-up`}>アカウントを作成する <ArrowRight size={17} /></a><a className="auth-secondary" href={`${basePath}/sign-in`}>ログインする</a></div>
    </div>
    <div className="auth-landing-points"><span><Leaf size={16} />環境行動を記録</span><span><Coins size={16} />コインを集める</span><span><Building2 size={16} />街を発展させる</span></div>
  </main>;
}

function AuthLoading() {
  return <main className="auth-loading"><span className="brand-mark"><Leaf size={25} fill="currentColor" /></span><p>エコとよおかを準備しています…</p></main>;
}

function SignInPage() {
  const { isLoaded, isSignedIn } = useAuth();
  if (isLoaded && isSignedIn) return <Redirect to="/user-portal" />;
  return <main className="auth-page"><SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} /></main>;
}

function SignUpPage() {
  const { isLoaded, isSignedIn } = useAuth();
  if (isLoaded && isSignedIn) return <Redirect to="/user-portal" />;
  return <main className="auth-page"><SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} /></main>;
}

function HomeRedirect() {
  const { isLoaded, isSignedIn } = useAuth();
  if (!isLoaded) return <AuthLoading />;
  return isSignedIn ? <Redirect to="/user-portal" /> : <AuthLanding />;
}

function UserPortal() {
  const { isLoaded, isSignedIn } = useAuth();
  if (!isLoaded) return <AuthLoading />;
  return isSignedIn ? <AppContent /> : <Redirect to="/" />;
}

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();
  return <ClerkProvider
    publishableKey={clerkPubKey}
    proxyUrl={clerkProxyUrl}
    appearance={clerkAppearance}
    signInUrl={`${basePath}/sign-in`}
    signUpUrl={`${basePath}/sign-up`}
    localization={{
      signIn: { start: { title: 'エコとよおかにログイン', subtitle: '街づくりの続きを始めよう' } },
      signUp: { start: { title: 'アカウントを作成', subtitle: '自分だけの豊岡を育てよう' } },
    }}
    routerPush={(to) => setLocation(stripBase(to))}
    routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
  >
    <Switch>
      <Route path="/" component={HomeRedirect} />
      <Route path="/sign-in/*?" component={SignInPage} />
      <Route path="/sign-up/*?" component={SignUpPage} />
      <Route path="/user-portal" component={UserPortal} />
      <Route component={HomeRedirect} />
    </Switch>
  </ClerkProvider>;
}

function App() {
  return <WouterRouter base={basePath}><ClerkProviderWithRoutes /></WouterRouter>;
}

export default App;