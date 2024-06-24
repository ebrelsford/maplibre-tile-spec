#!/usr/bin/env node

import { MltDecoder, TileSetMetadata } from '../src/index';
import * as VectorTile from '@mapbox/vector-tile';
import * as Protobuf from 'pbf';
import * as benchmark from 'benchmark';

const tiles = [
  'bing/4-8-5',
  'bing/4-12-6',
  'bing/4-13-6',
  'bing/5-15-10',
  'bing/5-16-11',
  'bing/5-16-9',
  'bing/5-17-10',
  'bing/5-17-11',
];

let maxTime = 10;

const runSuite = async (tile) => {
  console.log(`Running benchmarks for ${tile}`);
  let metadata: Buffer = await fetch(`../test/expected/${tile}.mlt.meta.pbf`);
  let mvtTile: Buffer = await fetch(`../test/fixtures/${tile}.mvt`);
  let mltTile: Buffer = await fetch(`../test/expected/${tile}.mlt`);
  const uri = tile.split('/')[1].split('-').map(Number);
  const { z, x, y } = { z: uri[0], x: uri[1], y: uri[2] };
  const tilesetMetadata = TileSetMetadata.fromBinary(metadata);

  return new Promise((resolve) => {
      const suite = new benchmark.Suite;
      suite
          .on('cycle', function(event: Event) {
              console.log(String(event.target));
          })
          .on('complete', () => {
              console.log('Fastest is ' + suite.filter('fastest').map('name'));
              resolve(null);
          })
          .add(`MLT ${tile}`, {
              defer: true,
              maxTime: maxTime,
              fn: (deferred: benchmark.Deferred) => {
                const decoded = MltDecoder.decodeMlTile(mltTile, tilesetMetadata);
                const features = [];
                for (const layer of decoded.layers) {
                  for (const feature of layer.features) {
                    features.push(feature.toGeoJSON(z, y, z));
                  }
                }
                deferred.resolve();
              }
          })
          .add(`MVT ${tile}`, {
            defer: true,
            maxTime: maxTime,
            fn: (deferred: benchmark.Deferred) => {
                const vectorTile = new VectorTile(new Protobuf(mvtTile));
                const features = [];
                const layers = Object.keys(vectorTile.layers);
                for (const layerName of layers) {
                  const layer = vectorTile.layers[layerName];
                  for (let i = 0; i < layer.length; i++) {
                    const feature = layer.feature(i);
                    features.push(feature.toGeoJSON(x, y, z));
                  }
                }
                deferred.resolve();
            }
        })
        .run({ 'async': true });
  })
}

const runSuites = async (tiles) => {
  for (const tile of tiles) {
      await runSuite(tile);
  }
}

runSuites(tiles);
