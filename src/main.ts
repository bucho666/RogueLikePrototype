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
  constructor(protected id: string, animatedSpeed: number=0.03) {
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

class Character extends GameObject {
  constructor(id: string) {
    super(id);
  }
}

class Cell {
  public character: Character;
  public terrain: Terrain;
  removeCharacter() {
    this.character = undefined;
  }
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

  putTerrain(t: Terrain, point: game.Point) {
    this.addChild(t);
    this.at(point).terrain = t;
    t.setPointByGrid(point);
  }

  fillTerrain(terrain: string) {
    for (let y = 0; y < this.cell.length; y++) {
      for (let x = 0; x < this.cell[y].length; x++) {
        this.putTerrain(Terrain.of(terrain), new game.Point(x, y));
      }
    }
  }

  putCharacter(ch: Character, point: game.Point) {
    this.addChild(ch);
    this.characterPoint.set(ch, point);
    this.at(point).character = ch;
    ch.setPointByGrid(point);
  }

  moveCharacter(ch: Character, direction: game.Direction) {
    const p = this.characterPoint.get(ch);
    this.at(p).removeCharacter();
    this.putCharacter(ch, p.plus(direction));
  }

  private at(point: game.Point): Cell {
    return this.cell[point.y][point.x];
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
    Terrain.regist('wall', 0xc0c0c0);
    Terrain.regist('wall_bottom', 0xc0c0c0);
    this.stage = new Stage(80, 20);
    this.stage.fillTerrain('floor');
    this.stage.putCharacter(this.hero, new game.Point(1, 1));
    this.addChild(this.stage);
    this.addChild(this.allow)
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

  pointerup() {
    this.hero.tint = (this.hero.tint == 0x33CCCC) ? 0xCC3333 : 0x33CCCC;
  }

  swipe(direction: game.Direction) {
    this.allow.visible = false;
    this.stage.moveCharacter(this.hero, direction);
    game.Audio.play('footstep');
  }
}

new game.Game({
  width: 375, height: 667,
  resolution: 1,
  backgroundColor: 'black'})
  .setSpriteScale(2)
  .registImage('resources', [
    ['floor', 'floor.png', 16],
    ['wall', 'wall.png', 16],
    ['wall_bottom', 'wall_bottom.png', 16],
    ['hero', 'hero.png', 16],
    ['allow', 'allow_symbol.png', 16]
  ]).registSound('resources', [
    ['footstep', 'footstep.wav'],
  ]).registScene([
    ['testScene', new TestScene()],
    ['titleScene', new TitleScene()]
  ]).start('titleScene');
