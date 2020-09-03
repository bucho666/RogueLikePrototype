import {
  Audio,
  Container,
  Coord,
  Direction,
  Game,
  Point,
  PointerState,
  Scene,
  Task,
  Sprite,
  Text,
} from './game';

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

class Character extends GameObject {}

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
  private characterCoord = new Map<Character, Coord>();
  constructor(width: number, height: number) {
    super();
    this.cell = Array.from(
      new Array(height), () => Array.from(
        new Array<Cell>(width), ()=> new Cell()
      )
    );
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
    this.characterCoord.set(ch, coord);
    this.at(coord).character = ch;
  }

  moveCharacter(ch: Character, direction: Direction): MoveResult {
    const
      p = this.characterCoord.get(ch),
      to = p.plus(direction),
      toCell = this.at(to);
    if (toCell.isPassable == false) {
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
    this.distance = to.distance(this.start);
  }

  process() {
    const
      progress = Math.min(1, this.elapsed / this.timeLimit) - 1,
      [sx, sy] = this.start.tuple,
      [dx, dy] = this.distance.tuple;
    this.target.x = this.easing_out(sx, dx, progress);
    this.target.y = this.easing_out(sy, dy, progress);
    if (progress == 1) {
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

class TestScene extends Scene {
  keyState = new Set<string>();
  hero: Character;
  allow: Sprite;
  stage: Stage;
  setup() {
    this.hero = new Character('hero');
    this.hero.tint = 0xc0c0c0;
    this.hero.position.set(64, 64);
    this.allow = new Sprite('allow', 0.05);
    this.allow.visible = false;
    Floor.regist('floor', 0x404040);
    Wall.regist('wall', 0xb3513a);
    Water.regist('water', 0x3d5aca);
    Door.regist('door', 0xa8842f);
    this.stage = new MapDesign(new Map([
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
    const startPoint = new Coord(67, 2);
    this.stage.putCharacter(this.hero, startPoint);
    this.hero.setPointByGrid(startPoint);
    this.update();
    this.addChild(this.stage);
    this.stage.addChild(this.allow)
  }

  pointermove(ps: PointerState) {
    this.allow.position = this.hero.position;
    if (ps.swipeDirection == Direction.Here) {
      this.allow.visible = false;
      return;
    }
    const
      [w, h] = [this.hero.width, this.hero.height],
      [a, x, y]= new Map<Direction, [number, number, number]>([
        [Direction.Right, [0, w, 0]], [Direction.DownRight, [45, w, h]],
        [Direction.Down, [90, 0, h]], [Direction.DownLeft, [135, -w, h]],
        [Direction.Left, [180, -w, 0]], [Direction.UpLeft, [225, -w, -h]],
        [Direction.Up, [270, 0, -h]], [Direction.UpRight, [315, w, -h]]
      ]).get(ps.swipeDirection);
    this.allow.angle = a;
    this.allow.x += x;
    this.allow.y += y;
    this.allow.visible = true;
  }

  swipe(direction: Direction) {
    this.allow.visible = false;
    const result = this.stage.moveCharacter(this.hero, direction);
    if (result.isMoved == false) {
      if (result.cell.isDoor) {
        result.cell.openTerrain();
        Audio.play('footstep');
      }
      return;
    }
    const to = new Coord(
        this.hero.width * result.coord.x,
        this.hero.height * result.coord.y
    );
    this.addTask(new EasingMove(this.hero, to, 400));
  }

  update() {
    const center = Scene.screen.center;
    this.stage.x = -this.hero.x + center.x;
    this.stage.y = -this.hero.y + center.y;
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
    ['allow', 'allow_symbol.png', 16]
  ]).registSound('resources', [
    ['footstep', 'footstep.wav'],
  ]).registScene([
    ['testScene', new TestScene()],
    ['titleScene', new TitleScene()]
  ]).start('titleScene');
