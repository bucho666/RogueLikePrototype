import {Size, Point, Coord, Direction} from './geometry';
import {
  Audio,
  Container,
  Game,
  PointerState,
  Scene,
  Task,
  Sprite,
  Text,
} from './game';
import { Graphics } from 'pixi.js';

class FlashSprite extends Task {
  constructor(private sprite: Sprite | Text, private interval: number) {
    super();
  }

  process(): Task {
    if (this.elapsed < this.interval) return;
    this.elapsed -= this.interval;
    this.sprite.visible = !this.sprite.visible;
  }
}

class TitleScene extends Scene {
  setup() {
    const message = new Text("Touch Start", 24, 0xc0c0c0, 0x808080);
    message.point = Scene.screen.center;
    message.anchor.set(0.5);
    this.addChild(message);
    this.addTask(new FlashSprite(message, 600));
  }

  pointerup() {
    Scene.change('testScene');
  }
}

abstract class GameObject extends Sprite {
  constructor(readonly id: string, animatedSpeed: number=0.03) {
    super(id, animatedSpeed);
  }

  setPointByGrid(point: Point) {
    this.x = point.x * this.width;
    this.y = point.y * this.height;
  }

  set textureIndex(i: number) {
    this.texture = this.textures[i];
  }

  get size(): Size {
    return {
      width: this.width,
      height: this.height
    };
  }
}

abstract class Terrain extends GameObject {
  static terrain = new Map<string, Terrain>();
  protected _isDoor: boolean = false;
  protected _isWall: boolean = false;
  protected constructor(id: string, tint: number, protected passable: boolean) {
    super(id);
    this.tint = tint;
  }

  static of(id: string): Terrain {
    return Terrain.terrain.get(id).clone();
  }

  get isPassable(): boolean {
    return this.passable;
  }

  get isWall(): boolean {
    return this._isWall;
  }

  get isDoor(): boolean {
    return this._isDoor;
  }

  abstract clone(): Terrain;

  open() {}
  close() {}
}

class Wall extends Terrain {
  static regist(id: string, tint: number) {
    Terrain.terrain.set(id, new Wall(id, tint));
  }

  constructor(id: string, tint: number) {
    super(id, tint, false);
    this._isWall = true;
    this.stop();
  }

  clone(): Terrain {
    return new Wall(this.id, this.tint);
  }

  open() {
    this.textureIndex = 1;
  }

  close() {
    this.textureIndex = 0;
  }
}

class Floor extends Terrain {
  static regist(id: string, tint: number) {
    Terrain.terrain.set(id, new Floor(id, tint));
  }

  constructor(id: string, tint: number) {
    super(id, tint, true);
  }

  clone(): Terrain {
    return new Floor(this.id, this.tint);
  }
}

class Door extends Terrain {
  static regist(id: string, tint: number) {
    Terrain.terrain.set(id, new Door(id, tint));
  }

  protected constructor(id: string, tint: number) {
    super(id, tint, false);
    this._isDoor = true;
    this.stop();
  }

  clone(): Terrain {
    return new Door(this.id, this.tint);
  }

  open() {
    this.textureIndex = 1;
    this.passable = true;
  }

  close() {
    this.textureIndex = 0;
    this.passable = false;
  }
}

class Water extends Terrain {
  static regist(id: string, tint: number) {
    Terrain.terrain.set(id, new Water(id, tint));
  }

  constructor(id: string, tint: number) {
    super(id, tint, false);
  }

  clone(): Terrain {
    return new Water(this.id, this.tint);
  }
}
abstract class Character extends GameObject {
  get isMonster(): boolean { return false; }
  get gridCoord(): Coord {
    return new Coord(this.x / this.width, this.y / this.height);
  }
}

class Hero extends Character {
  public isMoving = false;
  get isMonster(): boolean { return false; }
}

class Monster extends Character {
  get isMonster(): boolean { return true; }
}

class Cell {
  public character: Character;
  public _terrain: Terrain;
  removeCharacter() {
    this.character = undefined;
  }

  set terrain(newTerrain: Terrain) {
    if (this._terrain != undefined) {
      this._terrain.remove();
    }
    this._terrain = newTerrain;
  }

  get isPassable(): boolean {
    return this._terrain.isPassable;
  }

  get isWall(): boolean {
    return this._terrain.isWall;
  }

  get isDoor(): boolean {
    return this._terrain.isDoor;
  }

  openTerrain() {
    this._terrain.open();
  }

  closeTerrain() {
    this._terrain.close();
  }
}

class MoveResult {
  constructor(
    readonly isMoved: boolean,
    public coord: Coord,
    public cell: Cell,
  ){};
}

class Stage extends Container {
  private cell: Cell[][];
  private _monsters: Set<Monster>;
  constructor(width: number, height: number) {
    super();
    this.cell = Array.from(
      new Array(height), () => Array.from(
        new Array<Cell>(width), ()=> new Cell()
      )
    );
    this._monsters = new Set<Monster>();
  }

  get monsters(): IterableIterator<Monster> {
    return this._monsters.values();
  }

  putTerrain(terrainName: string, point: Point) {
    const t = Terrain.of(terrainName);
    this.addChild(t);
    this.at(point).terrain = t;
    t.setPointByGrid(point);
  }

  setWallFace(): Stage {
    for (let y = 0; y < this.cell.length-1; y++) {
      for (let x = 1; x < this.cell[y].length-1; x++) {
        const p = new Coord(x, y),
          cell = this.at(p),
          bottomCell = this.at(p.plus(Direction.Down));
        if (cell.isWall && !bottomCell.isWall) {
          cell.openTerrain();
        }
      }
    }
    return this;
  }

  fillTerrain(terrain: string) {
    for (let y = 0; y < this.cell.length; y++) {
      for (let x = 0; x < this.cell[y].length; x++) {
        this.putTerrain(terrain, new Direction(x, y));
      }
    }
  }

  putCharacter(ch: Character, coord: Coord) {
    this.addChild(ch);
    this.at(coord).character = ch;
    if (ch.isMonster) this._monsters.add(ch);
  }

  moveCharacter(ch: Character, direction: Direction): MoveResult {
    const
      p = ch.gridCoord,
      to = p.plus(direction),
      toCell = this.at(to);
    if (toCell.isPassable == false) {
      return new MoveResult(false, to, toCell);
    }
    if (toCell.character) {
      return new MoveResult(false, to, toCell);
    }
    this.at(p).removeCharacter();
    this.putCharacter(ch, to);
    return new MoveResult(true, to, toCell);
  }

  private at(point: Point): Cell {
    return this.cell[point.y][point.x];
  }
}

class EasingMove extends Task {
  private distance: Coord;
  private start: Coord;
  constructor(private target: Point, to: Coord, private timeLimit: number) {
    super();
    this.start = new Coord(target.x, target.y);
    this.distance = to.minus(this.start);
  }

  process() {
    const
      progress = Math.min(1, this.elapsed / this.timeLimit) - 1,
      [sx, sy] = this.start.tuple,
      [dx, dy] = this.distance.tuple;
    this.target.x = this.easing_out(sx, dx, progress);
    this.target.y = this.easing_out(sy, dy, progress);
    if (this.elapsed >= this.timeLimit) {
      this.done();
    }
  }

  easing_out(start: number, distance: number, p: number):number {
    return distance * (Math.pow(p, 3) + 1) + start;
  }
}

class MapDesign {
  constructor(readonly terrain: Map<string, string>, readonly map: string[]) {}
  get size(): [number, number] {
    return [this.map.length, this.map[0].length];
  }

  create(): Stage {
    const [h, w] = this.size;
    const stage = new Stage(w, h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        stage.putTerrain(
          this.terrain.get(this.map[y][x]),
          new Coord(x, y)
        );
      }
    }
    return stage;
  }
}

class Compass extends Container {
  circle: Graphics;
  constructor(private allow: Sprite, radius: number, color: number = 0xffffff,
              circleAlpha: number = 0.2, allowAlpha: number = 0.8) {
    super();
    this.circle = new Graphics()
        .beginFill(color, circleAlpha)
        .drawCircle(0, 0, radius)
        .endFill();
    this.allow.scale.set(radius / ((this.allow.height + 1) / 4));
    this.allow.alpha = allowAlpha;
    this.addChild(this.circle).addChild(this.allow);
  }

  set tint(tint: number) {
    this.circle.tint = this.allow.tint = tint;
  }

  setDirection(dir: Direction): Compass {
    this.allow.angle = dir.angle;
    return this;
  }
}

class Context {
  public pointer: PointerState;
  constructor(
    public scene: Scene,
    public stage: Stage,
    public hero: Hero) {}
}

class MoveHero {
  constructor(private ctx: Context){};
  execute() {
    const
      hero = this.ctx.hero,
      direction = this.ctx.pointer.swipeDirection,
      result = this.ctx.stage.moveCharacter(hero, direction);
    if (result.isMoved == false) {
      if (result.cell.isDoor) {
        result.cell.openTerrain();
        Audio.play('footstep');
      }
      return;
    }
    const to = result.coord.multiply(hero.size);
    hero.isMoving = true;
    this.addTask(new EasingMove(
      hero, to,
      Math.max(150, 600 - this.ctx.pointer.distance * 3))
      .onFinish(()=> { hero.isMoving = false; }));
  }

  private addTask(task: Task) {
    this.ctx.scene.addTask(task);
  }
}

class TestScene extends Scene {
  public swipePlay = 32;
  private ctx: Context;
  private compass: Compass;
  private moveHero: MoveHero;
  setup() {
    const
      stage = this.buildStage(),
      startPoint = new Coord(67, 2),
      hero = new Hero('hero'),
      dragon = new Monster('dragon'),
      dragonPoint = new Coord(68, 3);
    hero.tint = 0xc0c0c0;
    stage.putCharacter(hero, startPoint);
    hero.setPointByGrid(startPoint);
    dragon.tint = 0xbb0000;
    stage.putCharacter(dragon, dragonPoint);
    dragon.setPointByGrid(dragonPoint);
    this.ctx = new Context(this, stage, hero);
    this.moveHero = new MoveHero(this.ctx);
    this.update();
    this.compass = new Compass(new Sprite('compass'), this.swipePlay, 0xffffff, 0.2);
    this.compass.tint = hero.tint;
    this.compass.visible = false;
    this.addChild(stage)
    this.addChild(this.compass);
  }

  pointermove(ps: PointerState) {
    this.ctx.pointer = ps;
  }

  pointerup() {
    this.ctx.pointer = undefined;
    this.compass.visible = false;
  }

  update() {
    this.adjustCamera();
    if (this.ctx.pointer == undefined) return;
    const swipeDir = this.ctx.pointer.swipeDirection;
    if (this.ctx.pointer.start) {
      this.compass.position.set(...this.ctx.pointer.start.tuple);
      this.compass.setDirection(swipeDir).visible = true;;
    }
    if (this.ctx.hero.isMoving == false && this.ctx.pointer.distance >= this.swipePlay) {
      this.moveHero.execute();
    }
  }

  adjustCamera() {
    const center = Scene.screen.center;
    this.ctx.stage.x = -this.ctx.hero.x + center.x;
    this.ctx.stage.y = -this.ctx.hero.y + center.y;
  }

  private buildStage(): Stage {
    Floor.regist('floor', 0x404040);
    Wall.regist('wall', 0xb3513a);
    Water.regist('water', 0x3d5aca);
    Door.regist('door', 0xa8842f);
    return new MapDesign(new Map([
      ['#', 'wall'],
      ['.', 'floor'],
      ['~', 'water'],
      ['+', 'door'],
    ]), [
      '########################################################################',
      '#.............#..............#####.......##..~~~~~~~~~~~~~~~..##.......#',
      '#.#.........#.#..............#####.......##...~~~~~~~~~~~~~...##.......#',
      '#.............#.#####+#####......+.......##....~~~~~~~~~~~....##.......#',
      '#.#.#.#.#.#.#.#.#####.#####..#####.......##...................##.......#',
      '#.............#.####...####..#####.......###+######################+####',
      '######++#######.###.....###..###############.......################.####',
      '######..###.....###.....###..#####################.################.####',
      '#####...###.###############++#############.................########.####',
      '####...####.##...#####.............#######.....~~~~~~......########.####',
      '###...###...#..~.....+.............+..........~~~~~~~~..............####',
      '###...###.####...#####.............#######.....~~~~~~......#############',
      '###...###.#################++#############.................#############',
      '###...###.#################..#####.......#########+##########....#######',
      '###...###.#..................#####......~#########.#########......######',
      '###...###.#.#######+#######..#####.....~~#########.........+......######',
      '###...###.#.##...........##......+...~~~~###################......######',
      '###...###.#.#######+#######..#####.~~~~~~####################....#######',
      '###.......#..................###########################################',
      '########################################################################'
    ]).create().setWallFace();
  }
}

new Game({
  width: 375, height: 667,
  resolution: 1,
  backgroundColor: 0x212121})
  .setSpriteScale(2)
  .registImage('resources', [
    ['floor', 'floor.png', 16],
    ['wall', 'wall.png', 16],
    ['door', 'door.png', 16],
    ['water', 'water.png', 16],
    ['hero', 'hero.png', 16],
    ['dragon', 'dragon.png', 16],
    ['compass', 'compass.png', 31],
  ]).registSound('resources', [
    ['footstep', 'footstep.wav'],
  ]).registScene([
    ['testScene', new TestScene()],
    ['titleScene', new TitleScene()]
  ]).start('titleScene');
