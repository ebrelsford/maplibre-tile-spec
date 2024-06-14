import { MltDecoder, TileSetMetadata } from '..';
import { VectorTileLayer } from './vectortilelayer';

class VectorTile {
  layers: { [key: string]: VectorTileLayer } = {};

  constructor(data : Buffer, metadata : Buffer) {
    const parsedMetadata : TileSetMetadata = TileSetMetadata.fromBinary(metadata);

    for (const featureTable of parsedMetadata.featureTables) {
      this.layers[featureTable.name] = new VectorTileLayer(null, featureTable);
    }

    // XXX decoding fails currently
    try {
      const decoded = MltDecoder.decodeMlTile(data, parsedMetadata);
    }
    catch (e) { }

    // TODO fill in layers and features
  }
}

export { VectorTile };
