import { VectorTileFeature } from './vectortilefeature';

class VectorTileLayer {
  version: number;
  name: string | null;
  extent: number;

  _raw: Uint8Array;
  _keys: string[];
  _values: any[];
  _features: VectorTileFeature[] = [];

  constructor(data, metadata) {
    this.name = metadata.name;
  }
}

export { VectorTileLayer };
