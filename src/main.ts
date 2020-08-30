import * as game from './game';

class TitleScene extends game.Scene {
  setup() {
    const message = new game.Text("Touch Start", 24, 0xc0c0c0, 0x808080);
    message.point = game.Scene.screen.center;
    message.anchor.set(0.5);
    this.addChild(message);
    this.task.add(
      new game.Tasks(new game.SingleTask(()=> {
        message.visible = !message.visible;
      }).every(0.6))
    )
  }

  pointerup() {
    game.Scene.change('testScene');
  }
}

class GameObject extends game.Sprite {
  constructor(readonly id: string, animatedSpeed: number=0.03) {
    super(id, animatedSpeed);
  }

  setPointByGrid(point: game.Point) {
    this.x = point.x * this.width;
    this.y = point.y * this.height;
  }
}

class Terrain extends GameObject {
  static terrain = new Map<string, Terrain>();
  static regist(id: string, tint: number, passable: boolean=false) {
    Terrain.terrain.set(id, new Terrain(id, tint, passable));
  }

  private constructor(id: string, tint: number, readonly passable: boolean) {
    super(id);
    this.tint = tint;
  }

  static of(id: string): Terrain {
    return Terrain.terrain.get(id).clone();
  }

  clone(): Terrain {
    return new Terrain(this.id, this.tint, this.passable);
  }
}

class Character extends GameObject {}

class Cell {
  public character: Character;
  public _terrain: Terrain;
  removeCharacter() {
    this.character = undefined;
  }

  get terrain(): Terrain {
    return this._terrain;
  }

  set terrain(newTerrain: Terrain) {
    if (this._terrain != undefined) {
      this._terrain.remove();
    }
    this._terrain = newTerrain;
  }
}

class MoveResult {
  constructor(readonly isMoved: boolean){};
}

class Stage extends game.Container {
  private cell: Cell[][];
  private characterPoint = new Map<Character, game.Point>();
  constructor(width: number, height: number) {
    super();
    this.cell = Array.from(
      new Array(height), () => Array.from(
        new Array<Cell>(width), ()=> new Cell()
      )
    );
  }

  putTerrain(terrainName: string, point: game.Point) {
    const t = Terrain.of(terrainName);
    this.addChild(t);
    this.at(point).terrain = t;
    t.setPointByGrid(point);
  }

  setWallFalce(wall: string, face: string): Stage {
    for (let y = 0; y < this.cell.length-1; y++) {
      for (let x = 1; x < this.cell[y].length-1; x++) {
        const p = new game.Point(x, y);
        if (this.at(p).terrain.id == wall &&
            this.isPassable(p.plus(game.Down))) {
          this.putTerrain(face, p);
        }
      }
    }
    return this;
  }

  fillTerrain(terrain: string) {
    for (let y = 0; y < this.cell.length; y++) {
      for (let x = 0; x < this.cell[y].length; x++) {
        this.putTerrain(terrain, new game.Point(x, y));
      }
    }
  }

  putCharacter(ch: Character, point: game.Point) {
    this.addChild(ch);
    this.characterPoint.set(ch, point);
    this.at(point).character = ch;
    ch.setPointByGrid(point);
  }

  moveCharacter(ch: Character, direction: game.Direction): MoveResult {
    const
      p = this.characterPoint.get(ch),
      to = p.plus(direction);
    if (this.isPassable(to) == false) {
      return new MoveResult(false);
    }
    this.at(p).removeCharacter();
    this.putCharacter(ch, p.plus(direction));
    return new MoveResult(true);
  }

  isPassable(point: game.Point): boolean {
    return this.at(point).terrain.passable;
  }

  private at(point: game.Point): Cell {
    return this.cell[point.y][point.x];
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
          new game.Point(x, y)
        );
      }
    }
    return stage;
  }
}

class TestScene extends game.Scene {
  keyState = new Set<string>();
  hero: Character;
  allow: game.Sprite;
  stage: Stage;
  setup() {
    this.hero = new Character('hero');
    this.hero.tint = 0x33CCCC;
    this.hero.position.set(64, 64);
    this.allow = new game.Sprite('allow', 0.05);
    this.allow.visible = false;
    Terrain.regist('floor', 0x404040, true);
    Terrain.regist('wall', 0xb3513a);
    Terrain.regist('wall_face', 0xb3513a);
    this.stage = new MapDesign(new Map([
      ['#', 'wall'],
      ['.', 'floor'],
    ]), [
      '########################################################################',
      '#.............#..............#####.......##...................##.......#',
      '#.#.........#.#..............#####.......##...................##.......#',
      '#.............#.#####.#####..............##...................##.......#',
      '#.#.#.#.#.#.#.#.#####.#####..#####.......##...................##.......#',
      '#.............#.####...####..#####.......###.######################.####',
      '######..#######.###.....###..###############.......################.####',
      '######..###.....###.....###..#####################.################.####',
      '#####...###.###############..#############.................########.####',
      '####...####.##...#####.............#######.................########.####',
      '###...###...#.......................................................####',
      '###...###.####...#####.............#######.................#############',
      '###...###.#################..#############.................#############',
      '###...###.#################..#####.......#########.##########....#######',
      '###...###.#..................#####.......#########.#########......######',
      '###...###.#.#######.#######..#####.......#########................######',
      '###...###.#.##...........##..............###################......######',
      '###...###.#.#######.#######..#####.......####################....#######',
      '###.......#..................###########################################',
      '########################################################################'
    ]).create().setWallFalce('wall', 'wall_face');
    this.stage.putCharacter(this.hero, new game.Point(67, 2));
    this.adjustCamera();
    this.addChild(this.stage);
    this.stage.addChild(this.allow)
    // TODO Doorと湖の実装
    // TODO Swipmoveで移動を実装
  }

  pointermove(ps: game.PointerState) {
    this.allow.position = this.hero.position;
    if (ps.swipeDirection == game.Here) {
      this.allow.visible = false;
      return;
    }
    const
      [w, h] = [this.hero.width, this.hero.height],
      [a, x, y]= new Map<game.Direction, [number, number, number]>([
        [game.Right, [0, w, 0]], [game.DownRight, [45, w, h]],
        [game.Down, [90, 0, h]], [game.DownLeft, [135, -w, h]],
        [game.Left, [180, -w, 0]], [game.UpLeft, [225, -w, -h]],
        [game.Up, [270, 0, -h]], [game.UpRight, [315, w, -h]]
      ]).get(ps.swipeDirection);
    this.allow.angle = a;
    this.allow.x += x;
    this.allow.y += y;
    this.allow.visible = true;
  }

  swipe(direction: game.Direction) {
    this.allow.visible = false;
    const result = this.stage.moveCharacter(this.hero, direction);
    if (result.isMoved == false) {
      return;
    }
    this.adjustCamera();
   game.Audio.play('footstep');
  }

  private adjustCamera() {
    const center = game.Scene.screen.center;
    this.stage.x = -this.hero.x + center.x;
    this.stage.y = -this.hero.y + center.y;
  }
}

new game.Game({
  width: 375, height: 667,
  resolution: 1,
  backgroundColor: 0x212121})
  .setSpriteScale(2)
  .registImage('resources', [
    ['floor', 'floor.png', 16],
    ['wall', 'wall.png', 16],
    ['wall_face', 'wall_face.png', 16],
    ['hero', 'hero.png', 16],
    ['allow', 'allow_symbol.png', 16]
  ]).registSound('resources', [
    ['footstep', 'footstep.wav'],
  ]).registScene([
    ['testScene', new TestScene()],
    ['titleScene', new TitleScene()]
  ]).start('titleScene');
