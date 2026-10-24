// Type definitions for tr-geo-picker

export type Mode = 'il' | 'ilce';
export type ValueType = 'id' | 'name' | 'custom';
export type ViewLevel = 'turkiye' | 'bolge' | 'il';
export type DataLevel = 'catalog' | ViewLevel;

export interface CatalogItem {
  id: string;
  name: string;
  /** value-type="custom" için forma gidecek değer */
  value?: string;
}
export interface Bolge extends CatalogItem {
  iller: string[];
}
export interface Il extends CatalogItem {
  bolge: string;
}
export interface Ilce extends CatalogItem {
  il: string;
}
export interface Catalog {
  version?: string;
  bolgeler: Bolge[];
  iller: Il[];
  ilceler: Ilce[];
}

export interface GeoItem {
  id: string;
  /** SVG path */
  d: string;
  /** etiket / tooltip noktası */
  cx: number;
  cy: number;
}
export interface Geo {
  viewBox: string;
  items: GeoItem[];
}

/** null/undefined döndürülürse varsayılan zincire (data → data-src → paket) düşülür. */
export type DataProvider = (level: DataLevel, id?: string) => Catalog | Geo | null | undefined | Promise<Catalog | Geo | null | undefined>;

export type FilterItem = (Bolge | Il | Ilce) & { level: 'bolge' | 'il' | 'ilce' };
export type Filter = (item: FilterItem) => boolean;

export interface SelectionPart {
  id: string;
  name: string;
  value: string;
}
export interface Selection {
  bolge: SelectionPart | null;
  il: SelectionPart | null;
  ilce: SelectionPart | null;
}

export interface ValueEventDetail {
  value: string;
  selection: Selection;
}
export interface PathPart {
  level: ViewLevel;
  id: string | null;
  name: string;
}
export interface NavigateEventDetail {
  level: ViewLevel;
  id: string | null;
  path: PathPart[];
}
export interface LoadEventDetail {
  level: DataLevel;
  id: string | null;
}
export interface ErrorEventDetail extends LoadEventDetail {
  error: unknown;
}

export interface TrGeoPickerEventMap extends HTMLElementEventMap {
  input: CustomEvent<ValueEventDetail>;
  change: CustomEvent<ValueEventDetail>;
  'tks-navigate': CustomEvent<NavigateEventDetail>;
  'tks-load': CustomEvent<LoadEventDetail>;
  'tks-error': CustomEvent<ErrorEventDetail>;
}

export declare class TrGeoPicker extends HTMLElement {
  static readonly formAssociated: true;

  name: string | null;
  mode: Mode;
  value: string;
  valueType: ValueType;
  emitFields: boolean;
  dataSrc: string | null;
  theme: string | null;
  display: 'inline' | 'popover';
  size: string | null;
  searchable: boolean;
  required: boolean;
  disabled: boolean;
  readOnly: boolean;
  readonly: boolean;
  placeholder: string | null;
  locale: string;
  startRegion: string | null;
  startIl: string | null;
  lockLevel: boolean;
  nameSeparator: string;

  data: Catalog | null;
  dataProvider: DataProvider | null;
  filter: Filter | null;
  readonly selection: Selection;

  readonly form: HTMLFormElement | null;
  readonly validity: ValidityState;
  readonly validationMessage: string;
  readonly willValidate: boolean;
  checkValidity(): boolean;
  reportValidity(): boolean;

  reset(): void;
  goTo(level: ViewLevel, id?: string): Promise<void>;
  select(id: string): void;
  back(): void;
  open(): void;
  close(): void;

  addEventListener<K extends keyof TrGeoPickerEventMap>(
    type: K,
    listener: (this: TrGeoPicker, ev: TrGeoPickerEventMap[K]) => any,
    options?: boolean | AddEventListenerOptions,
  ): void;
  addEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions): void;
}

declare global {
  interface HTMLElementTagNameMap {
    'tr-geo-picker': TrGeoPicker;
  }
}
