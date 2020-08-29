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
      }).every(0.6).times(6))
      .add(new game.SingleTask(()=> {
        if (message.tint == 0xc0c0c0) {
          message.tint = 0xff0c0c;
        } else {
          message.tint = 0xc0c0c0;
        }
      }).every(0.12))
    ).add(new game.SingleTask(()=>{
      console.log('multi task');
    }).every(1));
  }

  pointerup() {
    game.Scene.change('testScene');
  }
}

class TestScene extends game.Scene {
  message: game.Text;
  keyState = new Set<string>();
  hero: game.Sprite;
  allow: game.Sprite;
  setup() {
    this.message = new game.Text("hello gameLib", 24, 0x0c0c0c0, 0x808080);
    this.message.point = game.Scene.screen.center;
    this.message.anchor.set(0.5);
    this.addChild(this.message);
    this.hero = new game.Sprite('hero', 0.03);
    this.hero.tint = 0x33CCCC;
    this.hero.position.set(64, 64);
    this.addChild(this.hero);
    this.allow = new game.Sprite('allow', 0.05);
    this.allow.visible = false;
    this.addChild(this.allow)
    window.addEventListener('keydown', (e: KeyboardEvent) => { this.keyState.add(e.key); }); window.addEventListener('keyup', (e: KeyboardEvent) => { this.keyState.delete(e.key); });
    game.Audio.play('bgm').volume(0.1).loop();
  }

  update() {
    if (this.keyState.has('l')) { this.hero.x += 3; }
    if (this.keyState.has('h')) { this.hero.x -= 3; }
    if (this.keyState.has('j')) { this.hero.y += 3; }
    if (this.keyState.has('k')) { this.hero.y -= 3; }
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
    this.hero.x += direction.x * this.hero.width;
    this.hero.y += direction.y * this.hero.height;
    game.Audio.play('footstep');
  }
}

new game.Game({
  width: 375, height: 667,
  resolution: 1,
  backgroundColor: 'black'})
  .setSpriteScale(2)
  .registImage('resources', [
    ['hero', 'hero.png', 16],
    ['allow', 'allow_symbol.png', 16]
  ]).registSound('resources', [
    ['footstep', 'footstep.wav'],
    ['bgm', '14_Aquarius (Block-6).mp3']
  ]).registScene([
    ['testScene', new TestScene()],
    ['titleScene', new TitleScene()]
  ]).start('titleScene');
