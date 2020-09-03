import * as PIXI from 'pixi.js';

export interface Point {
  x: number; y: number;
}

export class Coord implements Point {
  constructor(public x: number=0, public y: number=0){}

  distance(other: Point): Coord {
    return new Coord(this.x - other.x, this.y - other.y)
  }

  plus(other: Point): Coord {
    return new Coord(this.x + other.x, this.y + other.y)
  }

  get tuple(): [number, number] {
    return [this.x, this.y];
  }
}

export class Direction implements Point {
  static readonly Here = new Direction();
  static readonly Up = new Direction(0, -1);
  static readonly Right = new Direction(1, 0);
  static readonly Down = new Direction(0, 1);
  static readonly Left = new Direction(-1, 0);
  static readonly UpRight = new Direction(1, -1);
  static readonly DownRight = new Direction(1, 1);
  static readonly DownLeft = new Direction(-1, 1);
  static readonly UpLeft = new Direction(-1, -1);
  constructor(public x: number=0, public y: number=0){}
}

export class Size {
  constructor(public width: number, public height: number) {}
  get tuple(): [number, number] {
    return [this.width, this.height]
  }
}

class Ticker {
  private ticker = new PIXI.Ticker();

  constructor() {
    this.ticker = new PIXI.Ticker();
  }

  add(fn: ((elapsedMS: number)=>void)[]) {
    fn.forEach((f) => {
      this.ticker.add(f, PIXI.UPDATE_PRIORITY.LOW);
    });
  }

  start() {
    this.ticker.start();
  }

  get elapsedMS(): number {
    return this.ticker.elapsedMS;
  }
}

export abstract class Task {
  protected elapsed: number = 0;
  private isRunning: boolean = true;
  protected abstract process(): void;
  protected next: Task;
  protected tasks: Task[] = [];
  onFinish: (() => void)[] = [];

  protected done() {
    this.isRunning = false;
    this.onFinish.forEach(e => e());
  }

  addOnFinish(e: () => void):Task {
    this.onFinish.push(e);
    return this;
  }

  add(task: Task): Task {
    this.tasks.push(task);
    return this;
  }

  addNext(task: Task): Task {
    if (this.next) {
      this.next.addNext(task);
    } else {
      this.next = task;
    }
    return this;
  }

  update(elapsedMS: number): Task {
    this.elapsed += elapsedMS;
    if (this.isRunning) {
      this.process();
    }
    this.tasks = this.tasks.map(t => t.update(elapsedMS)).filter(t => t);
    if (this.isRunning || this.tasks.length > 1) {
      return this;
    }
    if (this.next) {
      return this.next;
    }
    return undefined;
  }
}

export class Text extends PIXI.Text {
  static defaultStyle = new PIXI.TextStyle({
    fontFamily: 'monospace',
    fontSize: 24,
    dropShadow: true,
    dropShadowColor: 0xd3d3d3,
    dropShadowDistance: 1
  });

  constructor(text: string, size: number, color?: number, shadowColor?: number) {
    const style = Text.defaultStyle.clone();
    style.fontSize = size;
    style.fill = color || style.fill;
    style.dropShadowColor = shadowColor || Text.defaultStyle.dropShadowColor;
    super(text, style);
  }

  set point(p: Point) {
    [this.x, this.y] = [p.x, p.y];
  }
}

export {
  Graphics as Graphics,
  Container as Container
} from 'pixi.js';

class SpriteSheet {
  constructor(public texture?: PIXI.Texture, public width?: number){}
  get base(): PIXI.BaseTexture {
    return this.texture.baseTexture;
  }

  get height(): number {
    return this.texture.height;
  }
}

export class Sprite extends PIXI.AnimatedSprite {
  private static spriteSheets = new Map<string, SpriteSheet>();
  static defaultScale = 1;

  static spriteSheet(id: string): SpriteSheet {
    if (!Sprite.spriteSheets.has(id)) {
      Sprite.spriteSheets.set(id, new SpriteSheet());
    }
    return Sprite.spriteSheets.get(id);
  }

  static registTexture(id: string, texture: PIXI.Texture) {
    Sprite.spriteSheet(id).texture = texture;
  }

  static registWidth(id: string, width: number) {
    Sprite.spriteSheet(id).width = width;
  }

  constructor(id: string, speed: number=0) {
    const
      ss = Sprite.spriteSheet(id),
      textures: PIXI.Texture[] = [];
    for (let x = 0; x < ss.texture.width; x += ss.width) {
      textures.push(new PIXI.Texture(ss.base, new PIXI.Rectangle(x, 0, ss.width, ss.height)));
    }
    super(textures);
    this.scale.set(Sprite.defaultScale);
    this.anchor.set(0.5, 0.5);
    this.animationSpeed = speed;
    this.play();
  }

  set point(p: Point) {
    [this.x, this.y] = [p.x, p.y];
  }

  remove() {
    this.parent.removeChild(this);
  }
}

export class Audio {
  private static context: AudioContext;
  private static cache = new Map<string, Audio>();

  static play(id: string): Audio {
    return Audio.cache[id].play();
  }

  static regist(id: string, buffer: ArrayBuffer) {
    Audio.context.decodeAudioData(buffer, (audioBuffer: AudioBuffer) => {
      Audio.cache[id] = new Audio(audioBuffer);
    });
  }

  static initialize(window: any) {
    const
      AudioContext = window.AudioContext || window.webkitAudioContext,
      eventName = 'pointerdown';
    Audio.context = new AudioContext();
    const releasePlaybackRestrictions = () => {
      document.removeEventListener(eventName, releasePlaybackRestrictions);
      Audio.context.resume();
      const silent = Audio.context.createBufferSource();
      silent.start();
      silent.stop();
    }
    document.addEventListener(eventName, releasePlaybackRestrictions);
  }

  constructor(private buffer: AudioBuffer,
              private gainNode: GainNode = undefined,
              private node: AudioBufferSourceNode = undefined) {
    this.gainNode = Audio.context.createGain();
    this.gainNode.connect(Audio.context.destination);
  }

  loop(): Audio {
    this.node.loop = true;
    return this;
  }

  volume(value: number): Audio {
    this.gainNode.gain.value = value;
    return this
  }

  play(): Audio {
    this.node = Audio.context.createBufferSource();
    this.node.buffer = this.buffer;
    this.node.connect(this.gainNode);
    this.node.start();
    return this;
  }

  stop() {
    if (!this.node) {
      return;
    }
    this.node.stop();
    this.node.buffer = null;
    this.node = null;
  }
}

class Loader {
  private loader: PIXI.Loader;

  constructor() {
    this.loader = new PIXI.Loader();
    const PixiResouce = PIXI.LoaderResource;
    for (let audioExtension of ['wav', 'mp3', 'ogg']) {
      PixiResouce.setExtensionLoadType(audioExtension, PixiResouce.LOAD_TYPE.XHR);
      PixiResouce.setExtensionXhrType(audioExtension, PixiResouce.XHR_RESPONSE_TYPE.BUFFER);
    }
    this.loader.use((resouce: PIXI.LoaderResource, next: Function) => {
      if (resouce.type == PIXI.LoaderResource.TYPE.IMAGE) {
        Sprite.registTexture(resouce.name, resouce.texture);
      } else {
        Audio.regist(resouce.name, resouce.data);
      }
      delete this.loader.resources[resouce.name];
      next();
    });
  }

  regist(id: string, path: string) {
    this.loader.add(id, path);
  }

  set baseUrl(url: string) {
    this.loader.baseUrl = url;
  }

  load(callback: ()=>void) {
    this.loader.onError.add((e: any) => { console.log(`Resouces Load: ${e}`) });
    this.loader.load(callback);
  }

  get(id: string): PIXI.LoaderResource {
    return this.loader.resources[id];
  }
}

class Screen {
  private renderer: PIXI.Renderer;
  private _scaleRatio: number = 1;

  constructor(config: Object) {
    PIXI.settings.SCALE_MODE = PIXI.SCALE_MODES.NEAREST;
    PIXI.settings.ROUND_PIXELS = true;
    this.renderer = new PIXI.Renderer(config);
    this.resize();
    window.addEventListener('resize', ()=>{ this.resize() });
    document.body.append(this.renderer.view);
  }

  get scaleRatio(): number {
    return this._scaleRatio;
  }

  addEventListener(type: string, callback: EventListener) {
    this.renderer.view.addEventListener(type, callback);
  }

  private resize() {
    const
      renderer = this.renderer,
      [sw, sh] = [renderer.width, renderer.height],
      [ww, wh] = [window.innerWidth, window.innerHeight],
      [swr, wwr] = [sw / sh, ww / wh],
      style = renderer.view.style;
    let [w, h] = [ww, wh];
    if (wwr > swr) {
      w = wh * (sw / sh);
    } else {
      h = ww * (sh / sw);
    }
    [style.width, style.height] = [`${w}px`, `${h}px`];
    this._scaleRatio = sw / w;
  }

  render(target: PIXI.DisplayObject) {
    this.renderer.render(target);
  }

  get width(): number {
    return this.renderer.width;
  }

  get height(): number {
    return this.renderer.height;
  }

  get center(): Coord {
    return new Coord(this.width / 2, this.height / 2);
  }
}

export class PointerState {
  readonly distance: Coord;
  readonly swipeDirection: Direction;
  constructor(play: number, readonly point: Coord, readonly start: Coord){
    if (start != undefined) {
      this.distance = this.point.distance(this.start);
      this.swipeDirection = this.getSwipeDirection(play);
    }
  }

  private getSwipeDirection(play: number): Direction {
    const
      [dx, dy] = this.distance.tuple,
      up = dy < -play, down = dy > play,
      right = dx > play, left = dx < -play;
    if (up && right) return Direction.UpRight;
    if (down && right) return Direction.DownRight;
    if (down && left) return Direction.DownLeft;
    if (up && left) return Direction.UpLeft;
    if (up) return Direction.Up;
    if (right) return Direction.Right;
    if (down) return Direction.Down;
    if (left) return Direction.Left;
    return Direction.Here;
  }
}

class Pointer {
  private _screenRatio: number;
  private _lastDownPoint: Coord;
  downEvent: (p: PointerState) => void;
  moveEvent: (p: PointerState) => void;
  upEvent: (p: PointerState) => void;
  swipeEvent: (directon: Direction) => void;

  constructor(screen: Screen, public _swipePlay: number = 64) {
    this.downEvent = () => {};
    this.moveEvent = () => {};
    this.upEvent = () => {};
    this.swipeEvent = () => {};
    this._lastDownPoint = new Coord();
    screen.addEventListener('pointerdown', (e: PointerEvent) => {
      this.down(e);
    });
    screen.addEventListener('pointermove', (e: PointerEvent) => {
      if (this._lastDownPoint) {
        this.move(e);
      }
    });
    screen.addEventListener('pointerup', (e: PointerEvent) => {
      this.up(e);
    });
    this._screenRatio = screen.scaleRatio;
  }

  set swipePlay(play: number) {
    this._swipePlay = play;
  }

  get lastDownPoint(): Coord {
    return this._lastDownPoint;
  }

  down(e: PointerEvent) {
    this._lastDownPoint = new Coord(e.offsetX * this._screenRatio, e.offsetY * this._screenRatio);
    this.downEvent(
      new PointerState(
        this._swipePlay,
        this._lastDownPoint,
        this._lastDownPoint
      ));
  }

  move(e: PointerEvent) {
    this.moveEvent(
      new PointerState(
        this._swipePlay,
        new Coord(e.offsetX * this._screenRatio, e.offsetY * this._screenRatio),
        this._lastDownPoint
      ));
  }

  up(e: PointerEvent) {
    const
      ps = new PointerState(
        this._swipePlay,
        new Coord(e.offsetX * this._screenRatio, e.offsetY * this._screenRatio),
        this._lastDownPoint
      );
    if (ps.swipeDirection == Direction.Here) {
      this.upEvent(ps);
    } else {
      this.swipeEvent(ps.swipeDirection);
    }
    this._lastDownPoint = undefined;
  }
}

export abstract class Scene extends PIXI.Container {
  static current: Scene;
  protected static screen: Screen;
  private static ticker = new Ticker();
  private static map = new Map<string, Scene>();
  private static pointer: Pointer;
  protected task: Task;

  static regist(scenes: [string, Scene][]) {
    for (const [id, scene] of scenes) {
      Scene.map.set(id, scene);
    }
  }

  static set swipePlay(play: number) {
    Scene.pointer.swipePlay = play;
  }

  static setupScreen(config: object) {
    Scene.screen = new Screen(config);
    Scene.pointer = new Pointer(this.screen);
  }

  static start(scene: string) {
    Scene.eventSetup();
    Scene.change(scene);
    Scene.ticker.add([Scene.render, Scene.update]);
    Scene.ticker.start();
  }

  private static eventSetup() {
    Scene.pointer.downEvent = (ps: PointerState) => {
      Scene.current.pointerdown(ps);
    };
    Scene.pointer.moveEvent = (ps: PointerState) => {
      Scene.current.pointermove(ps);
    };
    Scene.pointer.upEvent = (ps: PointerState) => {
      Scene.current.pointerup(ps);
    };
    Scene.pointer.swipeEvent = (direction: Direction) => {
      Scene.current.swipe(direction);
    };
  }

  static change(newScene: string) {
    Scene.current = Scene.of(newScene);
    Scene.current.setup();
  }

  static update() {
    const elapsedMS = Scene.ticker.elapsedMS;
    Scene.current.taskUpdate(elapsedMS);
    Scene.current.update(elapsedMS);
  }

  static render() {
    Scene.screen.render(Scene.current);
  }

  static of(id: string): Scene {
    return Scene.map.get(id);
  }

  abstract setup(): void;

  addTask(task: Task): Scene {
    if (this.task) {
      this.task.add(task);
    } else {
      this.task = task;
    }
    return this;
  }

  addNextTask(task: Task): Scene {
    if (this.task) {
      this.task.addNext(task);
    } else {
      this.task = task;
    }
    return this;
  }

  taskUpdate(elapsedMS: number) {
    if (this.task) {
      this.task = this.task.update(elapsedMS);
    }
  }

  update(_elapsedMS: number){};
  pointerup(_ps: PointerState){};
  pointermove(_ps: PointerState){};
  pointerdown(_ps: PointerState){};
  swipe(_direction: Direction){};
}

export class Game {
  private loader: Loader;
  constructor(private config: Object) {
    Audio.initialize(window);
    this.loader = new Loader();
  }

  registImage(baseUrl: string, images: [string, string, number][]): Game {
    this.loader.baseUrl = baseUrl;
    images.forEach(([id, path, width]) => {
      Sprite.registWidth(id, width);
      this.loader.regist(id, path);
    });
    return this;
  }

  registSound(baseUrl: string, sounds: [string, string][]): Game {
    this.loader.baseUrl = baseUrl;
    sounds.forEach((sound) => { this.loader.regist(...sound); });
    return this;
  }

  registScene(scenes: [string, Scene][]): Game {
    Scene.regist(scenes);
    return this;
  }

  setSpriteScale(scale: number): Game {
    Sprite.defaultScale = scale;
    return this;
  }

  SpipePlay(play: number): Game {
    Scene.swipePlay = play;
    return this;
  }

  start(scene: string) {
    this.loader.load(() => {
      Scene.setupScreen(this.config);
      Scene.start(scene);
    });
  }
}
