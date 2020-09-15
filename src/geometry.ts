import {random} from './random';

export interface Point {
  x: number; y: number;
}

export interface Size {
  height: number; width: number;
}

export class Coord implements Point {
  constructor(public x: number=0, public y: number=0){}

  minus(other: Point|Size): Coord {
    const [x, y] = this.xy(other);
    return new Coord(this.x - x, this.y - y)
  }

  plus(other: Point|Size): Coord {
    const [x, y] = this.xy(other);
    return new Coord(this.x + x, this.y + y)
  }

  multiply(other: Point|Size): Coord {
    const [x, y] = this.xy(other);
    return new Coord(this.x * x, this.y * y);
  }

  distance(other: Point): number {
    const [dx, dy] = this.minus(other).tuple;
    return Math.sqrt(Math.pow(dx, 2) + Math.pow(dy, 2));
  }

  get tuple(): [number, number] {
    return [this.x, this.y];
  }

  private xy(v: Point|Size): [number, number] {
    if ('x' in v) {
      const p = v as Point;
      return [p.x, p.y];
    }
    const size  = v as Size;
    return [size.width, size.height];
  }
}

export class Direction implements Point {
  static readonly Here = new Direction();
  static readonly Up = new Direction(0, -1, -90);
  static readonly Right = new Direction(1, 0, 0);
  static readonly Down = new Direction(0, 1, 90);
  static readonly Left = new Direction(-1, 0, 180);
  static readonly UpRight = new Direction(1, -1, -45);
  static readonly DownRight = new Direction(1, 1, 45);
  static readonly DownLeft = new Direction(-1, 1, 135);
  static readonly UpLeft = new Direction(-1, -1, -135);
  static all = [
    Direction.Up, Direction.Right, Direction.Down, Direction.Left,
    Direction.UpRight, Direction.DownRight, Direction.DownLeft, Direction.UpLeft
  ]

  static random(): Direction {
    return Direction.all[random(0, Direction.all.length)];
  }

  constructor(readonly x: number=0, readonly y: number=0, readonly angle: number = 0){}
}
