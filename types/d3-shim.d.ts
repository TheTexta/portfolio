declare module "d3" {
  export interface SimulationNodeDatum {
    x?: number;
    y?: number;
    vx?: number;
    vy?: number;
    fx?: number | null;
    fy?: number | null;
    index?: number;
  }

  export interface SimulationLinkDatum<NodeDatum extends SimulationNodeDatum> {
    source: string | NodeDatum;
    target: string | NodeDatum;
    index?: number;
  }

  export interface ForceLink<
    NodeDatum extends SimulationNodeDatum,
    LinkDatum extends SimulationLinkDatum<NodeDatum>,
  > {
    id(accessor: (node: NodeDatum) => string): this;
    distance(distance: number | ((link: LinkDatum, index: number, links: LinkDatum[]) => number)): this;
    strength(strength: number | ((link: LinkDatum, index: number, links: LinkDatum[]) => number)): this;
    initialize?(nodes: NodeDatum[]): void;
  }

  export interface ForceManyBody<NodeDatum extends SimulationNodeDatum> {
    strength(strength: number | ((node: NodeDatum, index: number, nodes: NodeDatum[]) => number)): this;
  }

  export interface ForceX<NodeDatum extends SimulationNodeDatum> {
    strength(strength: number): this;
  }

  export interface ForceY<NodeDatum extends SimulationNodeDatum> {
    strength(strength: number): this;
  }

  export interface ForceCollide<NodeDatum extends SimulationNodeDatum> {
    radius(radius: number | ((node: NodeDatum, index: number, nodes: NodeDatum[]) => number)): this;
    iterations(count: number): this;
    initialize?(nodes: NodeDatum[]): void;
  }

  export interface Simulation<
    NodeDatum extends SimulationNodeDatum,
    LinkDatum extends SimulationLinkDatum<NodeDatum> = SimulationLinkDatum<NodeDatum>,
  > {
    force(name: string): unknown;
    force(name: string, force: unknown): this;
    on(type: string, listener: () => void): this;
    alpha(): number;
    alpha(value: number): this;
    alphaTarget(value: number): this;
    restart(): this;
    stop(): this;
  }

  export function forceSimulation<
    NodeDatum extends SimulationNodeDatum,
    LinkDatum extends SimulationLinkDatum<NodeDatum> = SimulationLinkDatum<NodeDatum>,
  >(nodes?: NodeDatum[]): Simulation<NodeDatum, LinkDatum>;

  export function forceLink<
    NodeDatum extends SimulationNodeDatum,
    LinkDatum extends SimulationLinkDatum<NodeDatum>,
  >(links?: LinkDatum[]): ForceLink<NodeDatum, LinkDatum>;

  export function forceManyBody<NodeDatum extends SimulationNodeDatum>(): ForceManyBody<NodeDatum>;
  export function forceX<NodeDatum extends SimulationNodeDatum>(): ForceX<NodeDatum>;
  export function forceY<NodeDatum extends SimulationNodeDatum>(): ForceY<NodeDatum>;
  export function forceCollide<NodeDatum extends SimulationNodeDatum>(): ForceCollide<NodeDatum>;

  export interface ZoomTransform {
    k: number;
    x: number;
    y: number;
    scale(k: number): ZoomTransform;
    translate(x: number, y: number): ZoomTransform;
    invert(point: [number, number]): [number, number];
  }

  export const zoomIdentity: ZoomTransform;

  export interface Selection<GElement extends EventTarget> {
    call<Args extends unknown[]>(
      fn: (selection: Selection<GElement>, ...args: Args) => unknown,
      ...args: Args
    ): this;
    on(typenames: string, listener: null): this;
  }

  export function select<GElement extends EventTarget>(node: GElement): Selection<GElement>;

  export interface D3ZoomEvent<GElement extends EventTarget, Datum> {
    transform: ZoomTransform;
    sourceEvent: Event;
    type: string;
  }

  export interface ZoomBehavior<GElement extends EventTarget, Datum> {
    (selection: Selection<GElement>): void;
    scaleExtent(extent: [number, number]): this;
    filter(filterFn: (event: any) => boolean): this;
    on(type: string, listener: (event: D3ZoomEvent<GElement, Datum>) => void): this;
    transform(selection: Selection<GElement>, transform: ZoomTransform): void;
    translateTo(selection: Selection<GElement>, x: number, y: number): void;
  }

  export function zoom<GElement extends EventTarget, Datum>(): ZoomBehavior<GElement, Datum>;

  export interface D3DragEvent<GElement extends EventTarget, Datum, Subject> {
    active: boolean;
    sourceEvent: Event;
    subject: Subject;
  }

  export interface DragBehavior<GElement extends EventTarget, Datum, Subject> {
    (selection: Selection<GElement>): void;
    container(containerFn: () => EventTarget): this;
    subject(subjectFn: (event: any, datum: Datum) => Subject | null): this;
    on(type: string, listener: (event: D3DragEvent<GElement, Datum, Subject>) => void): this;
  }

  export function drag<
    GElement extends EventTarget,
    Datum,
    Subject = Datum,
  >(): DragBehavior<GElement, Datum, Subject>;

  export function pointer(event: any, target?: EventTarget): [number, number];
}
