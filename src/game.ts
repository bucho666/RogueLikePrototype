import * as PIXI from 'pixi.js';

export class Point {
  constructor(readonly x: number=0, readonly y: number=0){}

  distance(other: Point): Point {
    return new Point(this.x - other.x, this.y - other.y)
  }

  plus(other: Point): Point {
    return new Point(this.x + other.x, this.y + other.y)
  }

  get tuple(): [number, number] {
    return [this.x, this.y];
  }
}

export type Direction = Point;

export const
  Here = new Point(),
  Up = new Point(0, -1),
  Right = new Point(1, 0),
  Down = new Point(0, 1),
  Left = new Point(-1, 0),
  UpRight = Up.plus(Right),
  DownRight = Down.plus(Right),
  DownLeft = Down.plus(Left),
  UpLeft = Up.plus(Left);

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
  abstract update(elapsedMS: number): void;
  abstract get isDone(): boolean;
}

export class SingleTask extends Task {
  constructor(private callback: ()=>void,
              private _times: number = -1,
              private interval: number = 0,
              private elapse: number = 0) {
    super();
  }

  times(value: number): SingleTask {
    this._times = value;
    return this;
  }

  every(sec: number): SingleTask {
    this.interval = sec * 1000;
    return this;
  }

  update(elapsedMS: number) {
    this.elapse += elapsedMS;
    if (this.elapse < this.interval) {
      return;
    }
    this.callback();
    if (this._times > 0) {
      this._times--;
    }
    this.elapse -= this.interval;
  }

  get isDone(): boolean {
    return this._times == 0;
  }
}

export class Tasks extends Task {
  constructor(task: Task, private tasks: Task[] = []){
    super();
    this.add(task);
  };

  add(task: Task): Tasks {
    this.tasks.push(task);
    return this;
  }

  update(elapsedMS: number) {
    this.tasks[0].update(elapsedMS);
    if (this.tasks[0].isDone) {
      this.tasks.shift();
    }
  }

  get isDone(): boolean {
    return this.tasks.length == 0;
  }
}

export class MultiTask extends Task {
  constructor(private tasks: Set<Task> = new Set<Task>()){
    super();
  };

  add(task: Task): MultiTask {
    this.tasks.add(task);
    return this;
  }

  update(elapsedMS: number) {
    for (const task of this.tasks) {
      task.update(elapsedMS);
      if (task.isDone) {
        this.tasks.delete(task);
      }
    }
  }

  get isDone(): boolean {
    return this.tasks.size == 0;
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
    [this.x, this.y] = p.tuple;
  }
}

export {Graphics as Graphics} from 'pixi.js';

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
    [this.x, this.y] = p.tuple;
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
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    Audio.context = new AudioContext();
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

  get center(): Point {
    return new Point(this.width / 2, this.height / 2);
  }
}

export class PointerState {
  readonly distance: Point;
  readonly swipeDirection: Direction;
  constructor(play: number, readonly point: Point, readonly start: Point){
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
    if (up && right) return UpRight;
    if (down && right) return DownRight;
    if (down && left) return DownLeft;
    if (up && left) return UpLeft;
    if (up) return Up;
    if (right) return Right;
    if (down) return Down;
    if (left) return Left;
    return Here;
  }
}

class Pointer {
  private _screenRatio: number;
  private _lastDownPoint: Point;
  downEvent: (p: PointerState) => void;
  moveEvent: (p: PointerState) => void;
  upEvent: (p: PointerState) => void;
  swipeEvent: (directon: Direction) => void;

  constructor(screen: Screen, public _swipePlay: number = 64) {
    this.downEvent = () => {};
    this.moveEvent = () => {};
    this.upEvent = () => {};
    this.swipeEvent = () => {};
    this._lastDownPoint = new Point();
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

  get lastDownPoint(): Point {
    return this._lastDownPoint;
  }

  down(e: PointerEvent) {
    this._lastDownPoint = new Point(e.offsetX * this._screenRatio, e.offsetY * this._screenRatio);
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
        new Point(e.offsetX * this._screenRatio, e.offsetY * this._screenRatio),
        this._lastDownPoint
      ));
  }

  up(e: PointerEvent) {
    const
      ps = new PointerState(
        this._swipePlay,
        new Point(e.offsetX * this._screenRatio, e.offsetY * this._screenRatio),
        this._lastDownPoint
      );
    if (ps.swipeDirection == Here) {
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

  constructor(protected task: MultiTask = new MultiTask()) {
    super();
  }

  abstract setup(): void;

  taskUpdate(elapsedMS: number) {
    this.task.update(elapsedMS);
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
