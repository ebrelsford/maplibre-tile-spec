class VectorTileFeature {
  properties: { [key: string]: any } = {};
  extent: number;
  type: number = 0;

  _raw: Uint8Array;
  _geometry: any;
  _keys: string[];
  _values: any[];

  constructor() {
  }

  toGeoJSON() : { [key: string]: any } {
    throw new Error('toGeoJSON is not implemented');
    return {};
  }
}

export { VectorTileFeature };
