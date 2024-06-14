import * as Path from "path";
import * as fs from 'fs';

import { VectorTile } from '../../../src/mlt-vector-tile-js/vectortile';

const mltTilesDir = "../test/expected";

describe("VectorTile", () => {
  it("should have all layers", () => {
    const tilePath = Path.join(mltTilesDir, "bing", "4-13-6.mlt");
    const metadataPath = Path.join(mltTilesDir, "bing", "4-13-6.mlt.meta.pbf");
    const data : Buffer = fs.readFileSync(tilePath);
    const metadata : Buffer = fs.readFileSync(metadataPath);

    const tile : VectorTile = new VectorTile(data, metadata);

    expect(Object.keys(tile.layers)).toEqual([
      "water_feature",
      "road",
      "land_cover_grass",
      "country_region",
      "land_cover_forest",
      "road_hd",
      "vector_background",
      "populated_place",
      "admin_division1",
    ]);
  })
});
