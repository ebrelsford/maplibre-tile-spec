(function () {
    'use strict';

    // Intended to match the results of
    // https://github.com/mapbox/vector-tile-js/blob/77851380b63b07fd0af3d5a3f144cc86fb39fdd1/lib/vectortilefeature.js#L129
    class Projection {
        constructor(extent, x, y, z) {
            this.size = extent * Math.pow(2, z);
            this.x0 = extent * x;
            this.y0 = extent * y;
            this.s1 = 360 / this.size;
            this.s2 = 360 / Math.PI;
        }
        project(points) {
            const projected = new Array(points.length);
            for (let j = 0; j < points.length; j++) {
                const point = points[j];
                const y2 = 180 - (point.y + this.y0) * this.s1;
                projected[j] = [
                    (point.x + this.x0) * 360 / this.size - 180,
                    this.s2 * Math.atan(Math.exp(y2 * Math.PI / 180)) - 90
                ];
            }
            return projected;
        }
    }

    class Feature {
        constructor(id, extent, geometry, properties) {
            this.loadGeometry = () => {
                if (typeof this.geometry.loadGeometry === 'function') {
                    return this.geometry.loadGeometry();
                }
                else {
                    return [[this.geometry]];
                }
            };
            this.toGeoJSON = (x, y, z) => {
                let geometry;
                if (typeof this.geometry.toGeoJSON === 'function') {
                    geometry = this.geometry.toGeoJSON(this.extent, x, y, z);
                }
                else {
                    const projection = new Projection(this.extent, x, y, z);
                    const projected = projection.project([this.geometry]);
                    geometry = {
                        "type": "Point",
                        "coordinates": projected[0]
                    };
                }
                return {
                    type: "Feature",
                    id: Number(this.id),
                    geometry: geometry,
                    properties: this.properties
                };
            };
            this.id = id;
            this.geometry = geometry;
            this.properties = properties;
            this.extent = extent;
        }
    }

    class Layer {
        constructor(name, version, features) {
            this.name = name;
            this.features = features;
            this.version = version;
        }
    }

    class MapLibreTile {
        constructor(layers) {
            this.layers = layers;
        }
    }

    /**
     * @license BitSet.js v5.1.1 2/1/2020
     * http://www.xarg.org/2014/03/javascript-bit-array/
     *
     * Copyright (c) 2020, Robert Eisele (robert@xarg.org)
     * Dual licensed under the MIT or GPL Version 2 licenses.
     **/
    (function(root) {

      /**
       * The number of bits of a word
       * @const
       * @type number
       */
      var WORD_LENGTH = 32;

      /**
       * The log base 2 of WORD_LENGTH
       * @const
       * @type number
       */
      var WORD_LOG = 5;

      /**
       * Calculates the number of set bits
       *
       * @param {number} v
       * @returns {number}
       */
      function popCount(v) {

        // Warren, H. (2009). Hacker`s Delight. New York, NY: Addison-Wesley

        v -= ((v >>> 1) & 0x55555555);
        v = (v & 0x33333333) + ((v >>> 2) & 0x33333333);
        return (((v + (v >>> 4) & 0xF0F0F0F) * 0x1010101) >>> 24);
      }

      /**
       * Divide a number in base two by B
       *
       * @param {Array} arr
       * @param {number} B
       * @returns {number}
       */
      function divide(arr, B) {

        var r = 0;

        for (var i = 0; i < arr.length; i++) {
          r *= 2;
          var d = (arr[i] + r) / B | 0;
          r = (arr[i] + r) % B;
          arr[i] = d;
        }
        return r;
      }

      /**
       * Parses the parameters and set variable P
       *
       * @param {Object} P
       * @param {string|BitSet|Array|Uint8Array|number=} val
       */
      function parse(P, val) {

        if (val == null) {
          P['data'] = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
          P['_'] = 0;
          return;
        }

        if (val instanceof BitSet) {
          P['data'] = val['data'];
          P['_'] = val['_'];
          return;
        }

        switch (typeof val) {

          case 'number':
            P['data'] = [val | 0];
            P['_'] = 0;
            break;

          case 'string':

            var base = 2;
            var len = WORD_LENGTH;

            if (val.indexOf('0b') === 0) {
              val = val.substr(2);
            } else if (val.indexOf('0x') === 0) {
              val = val.substr(2);
              base = 16;
              len = 8;
            }

            P['data'] = [];
            P['_'] = 0;

            var a = val.length - len;
            var b = val.length;

            do {

              var num = parseInt(val.slice(a > 0 ? a : 0, b), base);

              if (isNaN(num)) {
                throw SyntaxError('Invalid param');
              }

              P['data'].push(num | 0);

              if (a <= 0)
                break;

              a -= len;
              b -= len;
            } while (1);

            break;

          default:

            P['data'] = [0];
            var data = P['data'];

            if (val instanceof Array) {

              for (var i = val.length - 1; i >= 0; i--) {

                var ndx = val[i];

                if (ndx === Infinity) {
                  P['_'] = -1;
                } else {
                  scale(P, ndx);
                  data[ndx >>> WORD_LOG] |= 1 << ndx;
                }
              }
              break;
            }

            if (Uint8Array && val instanceof Uint8Array) {

              var bits = 8;

              scale(P, val.length * bits);

              for (var i = 0; i < val.length; i++) {

                var n = val[i];

                for (var j = 0; j < bits; j++) {

                  var k = i * bits + j;

                  data[k >>> WORD_LOG] |= (n >> j & 1) << k;
                }
              }
              break;
            }
            throw SyntaxError('Invalid param');
        }
      }

      /**
       * Module entry point
       *
       * @constructor
       * @param {string|BitSet|number=} param
       * @returns {BitSet}
       */
      function BitSet(param) {

        if (!(this instanceof BitSet)) {
          return new BitSet(param);
        }
        parse(this, param);
        this['data'] = this['data'].slice();
      }

      function scale(dst, ndx) {

        var l = ndx >>> WORD_LOG;
        var d = dst['data'];
        var v = dst['_'];

        for (var i = d.length; l >= i; l--) {
          d.push(v);
        }
      }

      var P = {
        'data': [], // Holds the actual bits in form of a 32bit integer array.
        '_': 0 // Holds the MSB flag information to make indefinitely large bitsets inversion-proof
      };

      BitSet.prototype = {
        'data': [],
        '_': 0,
        /**
         * Set a single bit flag
         *
         * Ex:
         * bs1 = new BitSet(10);
         *
         * bs1.set(3, 1);
         *
         * @param {number} ndx The index of the bit to be set
         * @param {number=} value Optional value that should be set on the index (0 or 1)
         * @returns {BitSet} this
         */
        'set': function(ndx, value) {

          ndx |= 0;

          scale(this, ndx);

          if (value === undefined || value) {
            this['data'][ndx >>> WORD_LOG] |= (1 << ndx);
          } else {
            this['data'][ndx >>> WORD_LOG] &= ~(1 << ndx);
          }
          return this;
        },
        /**
         * Get a single bit flag of a certain bit position
         *
         * Ex:
         * bs1 = new BitSet();
         * var isValid = bs1.get(12);
         *
         * @param {number} ndx the index to be fetched
         * @returns {number} The binary flag
         */
        'get': function(ndx) {

          ndx |= 0;

          var d = this['data'];
          var n = ndx >>> WORD_LOG;

          if (n >= d.length) {
            return this['_'] & 1;
          }
          return (d[n] >>> ndx) & 1;
        },
        /**
         * Creates the bitwise NOT of a set.
         *
         * Ex:
         * bs1 = new BitSet(10);
         *
         * res = bs1.not();
         *
         * @returns {BitSet} A new BitSet object, containing the bitwise NOT of this
         */
        'not': function() { // invert()

          var t = this['clone']();
          var d = t['data'];
          for (var i = 0; i < d.length; i++) {
            d[i] = ~d[i];
          }

          t['_'] = ~t['_'];

          return t;
        },
        /**
         * Creates the bitwise AND of two sets.
         *
         * Ex:
         * bs1 = new BitSet(10);
         * bs2 = new BitSet(10);
         *
         * res = bs1.and(bs2);
         *
         * @param {BitSet} value A bitset object
         * @returns {BitSet} A new BitSet object, containing the bitwise AND of this and value
         */
        'and': function(value) {// intersection

          parse(P, value);

          var T = this['clone']();
          var t = T['data'];
          var p = P['data'];

          var pl = p.length;
          var p_ = P['_'];
          var t_ = T['_'];

          // If this is infinite, we need all bits from P
          if (t_ !== 0) {
            scale(T, pl * WORD_LENGTH - 1);
          }

          var tl = t.length;
          var l = Math.min(pl, tl);
          var i = 0;

          for (; i < l; i++) {
            t[i] &= p[i];
          }

          for (; i < tl; i++) {
            t[i] &= p_;
          }

          T['_'] &= p_;

          return T;
        },
        /**
         * Creates the bitwise OR of two sets.
         *
         * Ex:
         * bs1 = new BitSet(10);
         * bs2 = new BitSet(10);
         *
         * res = bs1.or(bs2);
         *
         * @param {BitSet} val A bitset object
         * @returns {BitSet} A new BitSet object, containing the bitwise OR of this and val
         */
        'or': function(val) { // union

          parse(P, val);

          var t = this['clone']();
          var d = t['data'];
          var p = P['data'];

          var pl = p.length - 1;
          var tl = d.length - 1;

          var minLength = Math.min(tl, pl);

          // Append backwards, extend array only once
          for (var i = pl; i > minLength; i--) {
            d[i] = p[i];
          }

          for (; i >= 0; i--) {
            d[i] |= p[i];
          }

          t['_'] |= P['_'];

          return t;
        },
        /**
         * Creates the bitwise XOR of two sets.
         *
         * Ex:
         * bs1 = new BitSet(10);
         * bs2 = new BitSet(10);
         *
         * res = bs1.xor(bs2);
         *
         * @param {BitSet} val A bitset object
         * @returns {BitSet} A new BitSet object, containing the bitwise XOR of this and val
         */
        'xor': function(val) { // symmetric difference

          parse(P, val);

          var t = this['clone']();
          var d = t['data'];
          var p = P['data'];

          var t_ = t['_'];
          var p_ = P['_'];

          var i = 0;

          var tl = d.length - 1;
          var pl = p.length - 1;

          // Cut if tl > pl
          for (i = tl; i > pl; i--) {
            d[i] ^= p_;
          }

          // Cut if pl > tl
          for (i = pl; i > tl; i--) {
            d[i] = t_ ^ p[i];
          }

          // XOR the rest
          for (; i >= 0; i--) {
            d[i] ^= p[i];
          }

          // XOR infinity
          t['_'] ^= p_;

          return t;
        },
        /**
         * Creates the bitwise AND NOT (not confuse with NAND!) of two sets.
         *
         * Ex:
         * bs1 = new BitSet(10);
         * bs2 = new BitSet(10);
         *
         * res = bs1.notAnd(bs2);
         *
         * @param {BitSet} val A bitset object
         * @returns {BitSet} A new BitSet object, containing the bitwise AND NOT of this and other
         */
        'andNot': function(val) { // difference

          return this['and'](new BitSet(val)['flip']());
        },
        /**
         * Flip/Invert a range of bits by setting
         *
         * Ex:
         * bs1 = new BitSet();
         * bs1.flip(); // Flip entire set
         * bs1.flip(5); // Flip single bit
         * bs1.flip(3,10); // Flip a bit range
         *
         * @param {number=} from The start index of the range to be flipped
         * @param {number=} to The end index of the range to be flipped
         * @returns {BitSet} this
         */
        'flip': function(from, to) {

          if (from === undefined) {

            var d = this['data'];
            for (var i = 0; i < d.length; i++) {
              d[i] = ~d[i];
            }

            this['_'] = ~this['_'];

          } else if (to === undefined) {

            scale(this, from);

            this['data'][from >>> WORD_LOG] ^= (1 << from);

          } else if (0 <= from && from <= to) {

            scale(this, to);

            for (var i = from; i <= to; i++) {
              this['data'][i >>> WORD_LOG] ^= (1 << i);
            }
          }
          return this;
        },
        /**
         * Clear a range of bits by setting it to 0
         *
         * Ex:
         * bs1 = new BitSet();
         * bs1.clear(); // Clear entire set
         * bs1.clear(5); // Clear single bit
         * bs1.clear(3,10); // Clear a bit range
         *
         * @param {number=} from The start index of the range to be cleared
         * @param {number=} to The end index of the range to be cleared
         * @returns {BitSet} this
         */
        'clear': function(from, to) {

          var data = this['data'];

          if (from === undefined) {

            for (var i = data.length - 1; i >= 0; i--) {
              data[i] = 0;
            }
            this['_'] = 0;

          } else if (to === undefined) {

            from |= 0;

            scale(this, from);

            data[from >>> WORD_LOG] &= ~(1 << from);

          } else if (from <= to) {

            scale(this, to);

            for (var i = from; i <= to; i++) {
              data[i >>> WORD_LOG] &= ~(1 << i);
            }
          }
          return this;
        },
        /**
         * Gets an entire range as a new bitset object
         *
         * Ex:
         * bs1 = new BitSet();
         * bs1.slice(4, 8);
         *
         * @param {number=} from The start index of the range to be get
         * @param {number=} to The end index of the range to be get
         * @returns {BitSet} A new smaller bitset object, containing the extracted range
         */
        'slice': function(from, to) {

          if (from === undefined) {
            return this['clone']();
          } else if (to === undefined) {

            to = this['data'].length * WORD_LENGTH;

            var im = Object.create(BitSet.prototype);

            im['_'] = this['_'];
            im['data'] = [0];

            for (var i = from; i <= to; i++) {
              im['set'](i - from, this['get'](i));
            }
            return im;

          } else if (from <= to && 0 <= from) {

            var im = Object.create(BitSet.prototype);
            im['data'] = [0];

            for (var i = from; i <= to; i++) {
              im['set'](i - from, this['get'](i));
            }
            return im;
          }
          return null;
        },
        /**
         * Set a range of bits
         *
         * Ex:
         * bs1 = new BitSet();
         *
         * bs1.setRange(10, 15, 1);
         *
         * @param {number} from The start index of the range to be set
         * @param {number} to The end index of the range to be set
         * @param {number} value Optional value that should be set on the index (0 or 1)
         * @returns {BitSet} this
         */
        'setRange': function(from, to, value) {

          for (var i = from; i <= to; i++) {
            this['set'](i, value);
          }
          return this;
        },
        /**
         * Clones the actual object
         *
         * Ex:
         * bs1 = new BitSet(10);
         * bs2 = bs1.clone();
         *
         * @returns {BitSet|Object} A new BitSet object, containing a copy of the actual object
         */
        'clone': function() {

          var im = Object.create(BitSet.prototype);
          im['data'] = this['data'].slice();
          im['_'] = this['_'];

          return im;
        },
        /**
         * Gets a list of set bits
         *
         * @returns {Array}
         */
        'toArray': Math['clz32'] ?
        function() {

          var ret = [];
          var data = this['data'];

          for (var i = data.length - 1; i >= 0; i--) {

            var num = data[i];

            while (num !== 0) {
              var t = 31 - Math['clz32'](num);
              num ^= 1 << t;
              ret.unshift((i * WORD_LENGTH) + t);
            }
          }

          if (this['_'] !== 0)
            ret.push(Infinity);

          return ret;
        } :
        function() {

          var ret = [];
          var data = this['data'];

          for (var i = 0; i < data.length; i++) {

            var num = data[i];

            while (num !== 0) {
              var t = num & -num;
              num ^= t;
              ret.push((i * WORD_LENGTH) + popCount(t - 1));
            }
          }

          if (this['_'] !== 0)
            ret.push(Infinity);

          return ret;
        },
        /**
         * Overrides the toString method to get a binary representation of the BitSet
         *
         * @param {number=} base
         * @returns string A binary string
         */
        'toString': function(base) {

          var data = this['data'];

          if (!base)
            base = 2;

          // If base is power of two
          if ((base & (base - 1)) === 0 && base < 36) {

            var ret = '';
            var len = 2 + Math.log(4294967295/*Math.pow(2, WORD_LENGTH)-1*/) / Math.log(base) | 0;

            for (var i = data.length - 1; i >= 0; i--) {

              var cur = data[i];

              // Make the number unsigned
              if (cur < 0)
                cur += 4294967296 /*Math.pow(2, WORD_LENGTH)*/;

              var tmp = cur.toString(base);

              if (ret !== '') {
                // Fill small positive numbers with leading zeros. The +1 for array creation is added outside already
                ret += '0'.repeat(len - tmp.length - 1);
              }
              ret += tmp;
            }

            if (this['_'] === 0) {

              ret = ret.replace(/^0+/, '');

              if (ret === '')
                ret = '0';
              return ret;

            } else {
              // Pad the string with ones
              ret = '1111' + ret;
              return ret.replace(/^1+/, '...1111');
            }

          } else {

            if ((2 > base || base > 36))
              throw SyntaxError('Invalid base');

            var ret = [];
            var arr = [];

            // Copy every single bit to a new array
            for (var i = data.length; i--; ) {

              for (var j = WORD_LENGTH; j--; ) {

                arr.push(data[i] >>> j & 1);
              }
            }

            do {
              ret.unshift(divide(arr, base).toString(base));
            } while (!arr.every(function(x) {
              return x === 0;
            }));

            return ret.join('');
          }
        },
        /**
         * Check if the BitSet is empty, means all bits are unset
         *
         * Ex:
         * bs1 = new BitSet(10);
         *
         * bs1.isEmpty() ? 'yes' : 'no'
         *
         * @returns {boolean} Whether the bitset is empty
         */
        'isEmpty': function() {

          if (this['_'] !== 0)
            return false;

          var d = this['data'];

          for (var i = d.length - 1; i >= 0; i--) {
            if (d[i] !== 0)
              return false;
          }
          return true;
        },
        /**
         * Calculates the number of bits set
         *
         * Ex:
         * bs1 = new BitSet(10);
         *
         * var num = bs1.cardinality();
         *
         * @returns {number} The number of bits set
         */
        'cardinality': function() {

          if (this['_'] !== 0) {
            return Infinity;
          }

          var s = 0;
          var d = this['data'];
          for (var i = 0; i < d.length; i++) {
            var n = d[i];
            if (n !== 0)
              s += popCount(n);
          }
          return s;
        },
        /**
         * Calculates the Most Significant Bit / log base two
         *
         * Ex:
         * bs1 = new BitSet(10);
         *
         * var logbase2 = bs1.msb();
         *
         * var truncatedTwo = Math.pow(2, logbase2); // May overflow!
         *
         * @returns {number} The index of the highest bit set
         */
        'msb': Math['clz32'] ?
        function() {

          if (this['_'] !== 0) {
            return Infinity;
          }

          var data = this['data'];

          for (var i = data.length; i-- > 0;) {

            var c = Math['clz32'](data[i]);

            if (c !== WORD_LENGTH) {
              return (i * WORD_LENGTH) + WORD_LENGTH - 1 - c;
            }
          }
          return Infinity;
        } :
        function() {

          if (this['_'] !== 0) {
            return Infinity;
          }

          var data = this['data'];

          for (var i = data.length; i-- > 0;) {

            var v = data[i];
            var c = 0;

            if (v) {

              for (; (v >>>= 1) > 0; c++) {
              }
              return (i * WORD_LENGTH) + c;
            }
          }
          return Infinity;
        },
        /**
         * Calculates the number of trailing zeros
         *
         * Ex:
         * bs1 = new BitSet(10);
         *
         * var ntz = bs1.ntz();
         *
         * @returns {number} The index of the lowest bit set
         */
        'ntz': function() {

          var data = this['data'];

          for (var j = 0; j < data.length; j++) {
            var v = data[j];

            if (v !== 0) {

              v = (v ^ (v - 1)) >>> 1; // Set v's trailing 0s to 1s and zero rest

              return (j * WORD_LENGTH) + popCount(v);
            }
          }
          return Infinity;
        },
        /**
         * Calculates the Least Significant Bit
         *
         * Ex:
         * bs1 = new BitSet(10);
         *
         * var lsb = bs1.lsb();
         *
         * @returns {number} The index of the lowest bit set
         */
        'lsb': function() {

          var data = this['data'];

          for (var i = 0; i < data.length; i++) {

            var v = data[i];
            var c = 0;

            if (v) {

              var bit = (v & -v);

              for (; (bit >>>= 1); c++) {

              }
              return WORD_LENGTH * i + c;
            }
          }
          return this['_'] & 1;
        },
        /**
         * Compares two BitSet objects
         *
         * Ex:
         * bs1 = new BitSet(10);
         * bs2 = new BitSet(10);
         *
         * bs1.equals(bs2) ? 'yes' : 'no'
         *
         * @param {BitSet} val A bitset object
         * @returns {boolean} Whether the two BitSets have the same bits set (valid for indefinite sets as well)
         */
        'equals': function(val) {

          parse(P, val);

          var t = this['data'];
          var p = P['data'];

          var t_ = this['_'];
          var p_ = P['_'];

          var tl = t.length - 1;
          var pl = p.length - 1;

          if (p_ !== t_) {
            return false;
          }

          var minLength = tl < pl ? tl : pl;
          var i = 0;

          for (; i <= minLength; i++) {
            if (t[i] !== p[i])
              return false;
          }

          for (i = tl; i > pl; i--) {
            if (t[i] !== p_)
              return false;
          }

          for (i = pl; i > tl; i--) {
            if (p[i] !== t_)
              return false;
          }
          return true;
        },
        [Symbol.iterator]: function () {

          var d = this['data'];
          var ndx = 0;

          if (this['_'] === 0) {

            // Find highest index with something meaningful
            var highest = 0;
            for (var i = d.length - 1; i >= 0; i--) {
              if (d[i] !== 0) {
                highest = i;
                break;
              }
            }

            return {
              'next': function () {
                var n = ndx >>> WORD_LOG;

                return {
                  'done': n > highest || n === highest && (d[n] >>> ndx) === 0,
                  'value': n > highest ? 0 : (d[n] >>> ndx++) & 1
                };
              }
            };

          } else {
            // Endless iterator!
            return {
              'next': function () {
                var n = ndx >>> WORD_LOG;

                return {
                  'done': false,
                  'value': n < d.length ? (d[n] >>> ndx++) & 1 : 1,
                };
              }
            };
          }
        }
      };

      BitSet['fromBinaryString'] = function(str) {

        return new BitSet('0b' + str);
      };

      BitSet['fromHexString'] = function(str) {

        return new BitSet('0x' + str);
      };

      BitSet['Random'] = function(n) {

        if (n === undefined || n < 0) {
          n = WORD_LENGTH;
        }

        var m = n % WORD_LENGTH;

        // Create an array, large enough to hold the random bits
        var t = [];
        var len = Math.ceil(n / WORD_LENGTH);

        // Create an bitset instance
        var s = Object.create(BitSet.prototype);

        // Fill the vector with random data, uniformally distributed
        for (var i = 0; i < len; i++) {
          t.push(Math.random() * 4294967296 | 0);
        }

        // Mask out unwanted bits
        if (m > 0) {
          t[len - 1] &= (1 << m) - 1;
        }

        s['data'] = t;
        s['_'] = 0;
        return s;
      };

      if (typeof define === 'function' && define['amd']) {
        define([], function() {
          return BitSet;
        });
      } else if (typeof exports === 'object') {
        Object.defineProperty(exports, "__esModule", { 'value': true });
        BitSet['default'] = BitSet;
        BitSet['BitSet'] = BitSet;
        module['exports'] = BitSet;
      } else {
        root['BitSet'] = BitSet;
      }

    })(undefined);

    var BitSet = /*#__PURE__*/Object.freeze({
        __proto__: null
    });

    class DecodingUtils {
        static decodeComponentwiseDeltaVec2(data) {
            data[0] = (data[0] >>> 1) ^ ((data[0] << 31) >> 31);
            data[1] = (data[1] >>> 1) ^ ((data[1] << 31) >> 31);
            for (let i = 2; i < data.length; i += 2) {
                data[i] = ((data[i] >>> 1) ^ ((data[i] << 31) >> 31)) + data[i - 2];
                data[i + 1] = ((data[i + 1] >>> 1) ^ ((data[i + 1] << 31) >> 31)) + data[i - 1];
            }
        }
        static decodeVarint(src, pos, numValues) {
            const values = new Array(numValues).fill(0);
            let dstOffset = 0;
            for (let i = 0; i < numValues; i++) {
                const offset = this.decodeVarintInternal(src, pos.get(), values, dstOffset);
                dstOffset++;
                pos.set(offset);
            }
            return values;
        }
        // Source: https://github.com/bazelbuild/bazel/blob/master/src/main/java/com/google/devtools/build/lib/util/VarInt.java
        static decodeVarintInternal(src, offset, dst, dstOffset) {
            let b = src[offset++];
            let value = b & 0x7f;
            if ((b & 0x80) === 0) {
                dst[dstOffset] = value;
                return offset;
            }
            b = src[offset++];
            value |= (b & 0x7f) << 7;
            if ((b & 0x80) === 0) {
                dst[dstOffset] = value;
                return offset;
            }
            b = src[offset++];
            value |= (b & 0x7f) << 14;
            if ((b & 0x80) === 0) {
                dst[dstOffset] = value;
                return offset;
            }
            b = src[offset++];
            value |= (b & 0x7f) << 21;
            dst[dstOffset] = value;
            return offset;
        }
        static decodeLongVarint(src, pos, numValues) {
            const values = new Array(numValues).fill(0n);
            for (let i = 0; i < numValues; i++) {
                const value = this.decodeLongVarintInternal(src, pos);
                values[i] = value;
            }
            return values;
        }
        static decodeLongVarintInternal(bytes, pos) {
            let value = 0n;
            let shift = 0;
            let index = pos.get();
            while (index < bytes.length) {
                const b = bytes[index++];
                value |= BigInt(b & 0x7F) << BigInt(shift);
                if ((b & 0x80) === 0) {
                    break;
                }
                shift += 7;
                if (shift >= 64) {
                    throw new Error("Varint too long");
                }
            }
            pos.set(index);
            return value;
        }
        static decodeZigZag(encoded) {
            return (encoded >>> 1) ^ (-(encoded & 1));
        }
        static decodeZigZagArray(encoded) {
            for (let i = 0; i < encoded.length; i++) {
                encoded[i] = this.decodeZigZag(encoded[i]);
            }
        }
        static decodeZigZagLong(encoded) {
            return (encoded >> 1n) ^ (-(encoded & 1n));
        }
        static decodeZigZagLongArray(encoded) {
            for (let i = 0; i < encoded.length; i++) {
                encoded[i] = this.decodeZigZagLong(encoded[i]);
            }
        }
        static decodeByteRle(buffer, numBytes, pos) {
            const values = new Uint8Array(numBytes);
            let valueOffset = 0;
            while (valueOffset < numBytes) {
                const header = buffer[pos.increment()];
                /* Runs */
                if (header <= 0x7f) {
                    const numRuns = header + 3;
                    const value = buffer[pos.increment()];
                    const endValueOffset = valueOffset + numRuns;
                    values.fill(value, valueOffset, endValueOffset);
                    valueOffset = endValueOffset;
                }
                else {
                    /* Literals */
                    const numLiterals = 256 - header;
                    for (let i = 0; i < numLiterals; i++) {
                        values[valueOffset++] = buffer[pos.increment()];
                    }
                }
            }
            return values;
        }
        static decodeUnsignedRLE(data, numRuns, numTotalValues) {
            const values = new Array(numTotalValues);
            let offset = 0;
            for (let i = 0; i < numRuns; i++) {
                const runLength = data[i];
                const value = data[i + numRuns];
                values.fill(value, offset, offset + runLength);
                offset += runLength;
            }
            return values;
        }
        static decodeUnsignedRLELong(data, numRuns, numTotalValues) {
            const values = new Array(numTotalValues).fill(0n);
            let offset = 0;
            for (let i = 0; i < numRuns; i++) {
                const runLength = data[i];
                const value = data[i + numRuns];
                values.fill(value, offset, offset + Number(runLength));
                offset += Number(runLength);
            }
            return values;
        }
        static decodeBooleanRle(buffer, numBooleans, pos) {
            const numBytes = Math.ceil(numBooleans / 8.0);
            return new BitSet(this.decodeByteRle(buffer, numBytes, pos));
        }
        static decodeFloatsLE(encodedValues, pos, numValues) {
            const fb = new Float32Array(new Uint8Array(encodedValues.slice(pos.get(), pos.get() + numValues * Float32Array.BYTES_PER_ELEMENT)).buffer);
            pos.set(pos.get() + numValues * Float32Array.BYTES_PER_ELEMENT);
            return fb;
        }
        static decodeDoublesLE(encodedValues, pos, numValues) {
            const bytesPerElement = Float64Array.BYTES_PER_ELEMENT;
            const fb = new Float64Array(new Uint16Array(encodedValues.slice(pos.get(), pos.get() + numValues * bytesPerElement)).buffer);
            pos.set(pos.get() + numValues * bytesPerElement);
            return fb;
        }
    }

    var PhysicalStreamType;
    (function (PhysicalStreamType) {
        PhysicalStreamType["PRESENT"] = "PRESENT";
        PhysicalStreamType["DATA"] = "DATA";
        PhysicalStreamType["OFFSET"] = "OFFSET";
        PhysicalStreamType["LENGTH"] = "LENGTH";
    })(PhysicalStreamType || (PhysicalStreamType = {}));

    class LogicalStreamType {
        constructor(dictionary_type, offset_type, length_type) {
            if (dictionary_type) {
                this.dictionary_type = dictionary_type;
            }
            else if (offset_type) {
                this.offset_type = offset_type;
            }
            else if (length_type) {
                this.length_type = length_type;
            }
        }
        dictionaryType() {
            return this.dictionary_type;
        }
        offsetType() {
            return this.offset_type;
        }
        lengthType() {
            return this.length_type;
        }
    }

    var LogicalLevelTechnique;
    (function (LogicalLevelTechnique) {
        LogicalLevelTechnique["NONE"] = "NONE";
        LogicalLevelTechnique["DELTA"] = "DELTA";
        LogicalLevelTechnique["COMPONENTWISE_DELTA"] = "COMPONENTWISE_DELTA";
        LogicalLevelTechnique["RLE"] = "RLE";
        LogicalLevelTechnique["MORTON"] = "MORTON";
        // Pseudodecimal Encoding of floats -> only for the exponent integer part an additional logical level technique is used.
        // Both exponent and significant parts are encoded with the same physical level technique
        LogicalLevelTechnique["PDE"] = "PDE";
    })(LogicalLevelTechnique || (LogicalLevelTechnique = {}));

    var PhysicalLevelTechnique;
    (function (PhysicalLevelTechnique) {
        PhysicalLevelTechnique["NONE"] = "NONE";
        /**
         * Preferred option, tends to produce the best compression ratio and decoding performance.
         * But currently only limited to 32 bit integer.
         */
        PhysicalLevelTechnique["FAST_PFOR"] = "FAST_PFOR";
        /**
         * Can produce better results in combination with a heavyweight compression scheme like Gzip.
         * Simple compression scheme where the decoder are easier to implement compared to FastPfor.
         */
        PhysicalLevelTechnique["VARINT"] = "VARINT";
        /**
         * Adaptive Lossless floating-Point Compression
         */
        PhysicalLevelTechnique["ALP"] = "ALP";
    })(PhysicalLevelTechnique || (PhysicalLevelTechnique = {}));

    var DictionaryType;
    (function (DictionaryType) {
        DictionaryType["NONE"] = "NONE";
        DictionaryType["SINGLE"] = "SINGLE";
        DictionaryType["SHARED"] = "SHARED";
        DictionaryType["VERTEX"] = "VERTEX";
        DictionaryType["MORTON"] = "MORTON";
        DictionaryType["FSST"] = "FSST";
    })(DictionaryType || (DictionaryType = {}));

    var OffsetType;
    (function (OffsetType) {
        OffsetType["VERTEX"] = "VERTEX";
        OffsetType["INDEX"] = "INDEX";
        OffsetType["STRING"] = "STRING";
        OffsetType["KEY"] = "KEY";
    })(OffsetType || (OffsetType = {}));

    var LengthType;
    (function (LengthType) {
        LengthType["VAR_BINARY"] = "VAR_BINARY";
        LengthType["GEOMETRIES"] = "GEOMETRIES";
        LengthType["PARTS"] = "PARTS";
        LengthType["RINGS"] = "RINGS";
        LengthType["TRIANGLES"] = "TRIANGLES";
        LengthType["SYMBOL"] = "SYMBOL";
        LengthType["DICTIONARY"] = "DICTIONARY";
    })(LengthType || (LengthType = {}));

    class StreamMetadata {
        constructor(physical_stream_type, logical_stream_type, logical_level_technique1, logical_level_technique2, physical_level_technique, num_values, byte_length) {
            this.physical_stream_type = physical_stream_type;
            this.logical_stream_type = logical_stream_type;
            this.logical_level_technique1 = logical_level_technique1;
            this.logical_level_technique2 = logical_level_technique2;
            this.physical_level_technique = physical_level_technique;
            this.num_values = num_values;
            this.byte_length = byte_length;
        }
        static decode(tile, offset) {
            const stream_type = tile[offset.get()];
            const physical_stream_type = Object.values(PhysicalStreamType)[stream_type >> 4];
            let logical_stream_type = null;
            switch (physical_stream_type) {
                case PhysicalStreamType.DATA:
                    logical_stream_type = new LogicalStreamType(Object.values(DictionaryType)[stream_type & 0xf]);
                    break;
                case PhysicalStreamType.OFFSET:
                    logical_stream_type = new LogicalStreamType(null, Object.values(OffsetType)[stream_type & 0xf]);
                    break;
                case PhysicalStreamType.LENGTH:
                    logical_stream_type = new LogicalStreamType(null, null, Object.values(LengthType)[stream_type & 0xf]);
                    break;
            }
            offset.increment();
            const encodings_header = tile[offset.get()] & 0xFF;
            const logical_level_technique1 = Object.values(LogicalLevelTechnique)[encodings_header >> 5];
            const logical_level_technique2 = Object.values(LogicalLevelTechnique)[encodings_header >> 2 & 0x7];
            const physical_level_technique = Object.values(PhysicalLevelTechnique)[encodings_header & 0x3];
            offset.increment();
            const size_info = DecodingUtils.decodeVarint(tile, offset, 2);
            const num_values = size_info[0];
            const byte_length = size_info[1];
            return new StreamMetadata(physical_stream_type, logical_stream_type, logical_level_technique1, logical_level_technique2, physical_level_technique, num_values, byte_length);
        }
        physicalStreamType() {
            return this.physical_stream_type;
        }
        logicalStreamType() {
            return this.logical_stream_type;
        }
        logicalLevelTechnique1() {
            return this.logical_level_technique1;
        }
        logicalLevelTechnique2() {
            return this.logical_level_technique2;
        }
        physicalLevelTechnique() {
            return this.physical_level_technique;
        }
        numValues() {
            return this.num_values;
        }
        byteLength() {
            return this.byte_length;
        }
    }

    class MortonEncodedStreamMetadata extends StreamMetadata {
        constructor(physicalStreamType, logicalStreamType, logicalLevelTechnique1, logicalLevelTechnique2, physicalLevelTechnique, numValues, byteLength, numBits, coordinateShift) {
            super(physicalStreamType, logicalStreamType, logicalLevelTechnique1, logicalLevelTechnique2, physicalLevelTechnique, numValues, byteLength);
            this.num_bits = numBits;
            this.coordinate_shift = coordinateShift;
        }
        static decode(tile, offset) {
            const streamMetadata = StreamMetadata.decode(tile, offset);
            const mortonInfo = DecodingUtils.decodeVarint(tile, offset, 2);
            return new MortonEncodedStreamMetadata(streamMetadata.physicalStreamType(), streamMetadata.logicalStreamType(), streamMetadata.logicalLevelTechnique1(), streamMetadata.logicalLevelTechnique2(), streamMetadata.physicalLevelTechnique(), streamMetadata.numValues(), streamMetadata.byteLength(), mortonInfo[0], mortonInfo[1]);
        }
        static decodePartial(streamMetadata, tile, offset) {
            const mortonInfo = DecodingUtils.decodeVarint(tile, offset, 2);
            return new MortonEncodedStreamMetadata(streamMetadata.physicalStreamType(), streamMetadata.logicalStreamType(), streamMetadata.logicalLevelTechnique1(), streamMetadata.logicalLevelTechnique2(), streamMetadata.physicalLevelTechnique(), streamMetadata.numValues(), streamMetadata.byteLength(), mortonInfo[0], mortonInfo[1]);
        }
        numBits() {
            return this.num_bits;
        }
        coordinateShift() {
            return this.coordinate_shift;
        }
    }

    class RleEncodedStreamMetadata extends StreamMetadata {
        constructor(physicalStreamType, logicalStreamType, logicalLevelTechnique1, logicalLevelTechnique2, physicalLevelTechnique, numValues, byteLength, runs, numRleValues) {
            super(physicalStreamType, logicalStreamType, logicalLevelTechnique1, logicalLevelTechnique2, physicalLevelTechnique, numValues, byteLength);
            this.runCount = runs;
            this.num_rle_values = numRleValues;
        }
        static decode(tile, offset) {
            const streamMetadata = StreamMetadata.decode(tile, offset);
            const rleInfo = DecodingUtils.decodeVarint(tile, offset, 2);
            return new RleEncodedStreamMetadata(streamMetadata.physicalStreamType(), streamMetadata.logicalStreamType(), streamMetadata.logicalLevelTechnique1(), streamMetadata.logicalLevelTechnique2(), streamMetadata.physicalLevelTechnique(), streamMetadata.numValues(), streamMetadata.byteLength(), rleInfo[0], rleInfo[1]);
        }
        static decodePartial(streamMetadata, tile, offset) {
            const rleInfo = DecodingUtils.decodeVarint(tile, offset, 2);
            return new RleEncodedStreamMetadata(streamMetadata.physicalStreamType(), streamMetadata.logicalStreamType(), streamMetadata.logicalLevelTechnique1(), streamMetadata.logicalLevelTechnique2(), streamMetadata.physicalLevelTechnique(), streamMetadata.numValues(), streamMetadata.byteLength(), rleInfo[0], rleInfo[1]);
        }
        runs() {
            return this.runCount;
        }
        numRleValues() {
            return this.num_rle_values;
        }
    }

    class StreamMetadataDecoder {
        static decode(tile, offset) {
            const streamMetadata = StreamMetadata.decode(tile, offset);
            if (streamMetadata.logicalLevelTechnique1() === LogicalLevelTechnique.MORTON) {
                return MortonEncodedStreamMetadata.decodePartial(streamMetadata, tile, offset);
            }
            else if ((LogicalLevelTechnique.RLE === streamMetadata.logicalLevelTechnique1() ||
                LogicalLevelTechnique.RLE === streamMetadata.logicalLevelTechnique2()) &&
                PhysicalLevelTechnique.NONE !== streamMetadata.physicalLevelTechnique()) {
                return RleEncodedStreamMetadata.decodePartial(streamMetadata, tile, offset);
            }
            return streamMetadata;
        }
    }

    // Ported from https://github.com/lemire/JavaFastPFOR/blob/master/src/main/java/me/lemire/integercompression/IntWrapper.java
    class IntWrapper {
        constructor(v) {
            this.v = v;
            this.value = v;
        }
        get() {
            return this.value;
        }
        set(v) {
            this.value = v;
        }
        increment() {
            return this.value++;
        }
        add(v) {
            this.value += v;
        }
    }

    class IntegerDecoder {
        static decodeMortonStream(data, offset, streamMetadata) {
            let values;
            if (streamMetadata.physicalLevelTechnique() === PhysicalLevelTechnique.FAST_PFOR) {
                throw new Error("Specified physical level technique not yet supported: " + streamMetadata.physicalLevelTechnique());
                // TODO
                //values = DecodingUtils.decodeFastPfor128(data, streamMetadata.numValues(), streamMetadata.byteLength(), offset);
            }
            else if (streamMetadata.physicalLevelTechnique() === PhysicalLevelTechnique.VARINT) {
                values = DecodingUtils.decodeVarint(data, offset, streamMetadata.numValues());
            }
            else {
                throw new Error("Specified physical level technique not yet supported: " + streamMetadata.physicalLevelTechnique());
            }
            return this.decodeMortonDelta(values, streamMetadata.numBits(), streamMetadata.coordinateShift());
        }
        static decodeMortonDelta(data, numBits, coordinateShift) {
            const vertices = [];
            let previousMortonCode = 0;
            for (const deltaCode of data) {
                const mortonCode = previousMortonCode + deltaCode;
                const vertex = this.decodeMortonCode(mortonCode, numBits, coordinateShift);
                vertices.push(vertex[0], vertex[1]);
                previousMortonCode = mortonCode;
            }
            return vertices;
        }
        static decodeMortonCodes(data, numBits, coordinateShift) {
            const vertices = [];
            for (const mortonCode of data) {
                const vertex = this.decodeMortonCode(mortonCode, numBits, coordinateShift);
                vertices.push(vertex[0], vertex[1]);
            }
            return vertices;
        }
        static decodeMortonCode(mortonCode, numBits, coordinateShift) {
            const x = this.decodeMorton(mortonCode, numBits) - coordinateShift;
            const y = this.decodeMorton(mortonCode >> 1, numBits) - coordinateShift;
            return [x, y];
        }
        static decodeMorton(code, numBits) {
            let coordinate = 0;
            for (let i = 0; i < numBits; i++) {
                coordinate |= (code & (1 << (2 * i))) >> i;
            }
            return coordinate;
        }
        static decodeIntStream(data, offset, streamMetadata, isSigned) {
            let values;
            if (streamMetadata.physicalLevelTechnique() === PhysicalLevelTechnique.FAST_PFOR) {
                throw new Error("Specified physical level technique not yet supported: " + streamMetadata.physicalLevelTechnique());
                // TODO
                //values = DecodingUtils.decodeFastPfor128(data, streamMetadata.numValues(), streamMetadata.byteLength(), offset);
            }
            else if (streamMetadata.physicalLevelTechnique() === PhysicalLevelTechnique.VARINT) {
                values = DecodingUtils.decodeVarint(data, offset, streamMetadata.numValues());
            }
            else {
                throw new Error("Specified physical level technique not yet supported: " + streamMetadata.physicalLevelTechnique());
            }
            return this.decodeIntArray(values, streamMetadata, isSigned);
        }
        static decodeIntArray(values, streamMetadata, isSigned) {
            switch (streamMetadata.logicalLevelTechnique1()) {
                case LogicalLevelTechnique.DELTA: {
                    if (streamMetadata.logicalLevelTechnique2() === LogicalLevelTechnique.RLE) {
                        const rleMetadata = streamMetadata;
                        values =
                            DecodingUtils.decodeUnsignedRLE(values, rleMetadata.runs(), rleMetadata.numRleValues());
                        return this.decodeZigZagDelta(values);
                    }
                    return this.decodeZigZagDelta(values);
                }
                case LogicalLevelTechnique.RLE: {
                    const rleMetadata = streamMetadata;
                    const decodedValues = this.decodeRLE(values, rleMetadata.runs());
                    return isSigned ? this.decodeZigZag(decodedValues) : decodedValues;
                }
                case LogicalLevelTechnique.NONE: {
                    return isSigned ? this.decodeZigZag(values) : values;
                }
                case LogicalLevelTechnique.MORTON: {
                    const mortonMetadata = streamMetadata;
                    return this.decodeMortonCodes(values, mortonMetadata.numBits(), mortonMetadata.coordinateShift());
                }
                case LogicalLevelTechnique.COMPONENTWISE_DELTA: {
                    DecodingUtils.decodeComponentwiseDeltaVec2(values);
                    return values;
                }
                default:
                    throw new Error("The specified logical level technique is not supported for integers: " + streamMetadata.logicalLevelTechnique1());
            }
        }
        static decodeLongStream(data, offset, streamMetadata, isSigned) {
            if (streamMetadata.physicalLevelTechnique() !== PhysicalLevelTechnique.VARINT) {
                throw new Error("Specified physical level technique not yet supported: " + streamMetadata.physicalLevelTechnique());
            }
            const values = DecodingUtils.decodeLongVarint(data, offset, streamMetadata.numValues());
            return this.decodeLongArray(values, streamMetadata, isSigned);
        }
        static decodeLongArray(values, streamMetadata, isSigned) {
            switch (streamMetadata.logicalLevelTechnique1()) {
                case LogicalLevelTechnique.DELTA: {
                    if (streamMetadata.logicalLevelTechnique2() === LogicalLevelTechnique.RLE) {
                        const rleMetadata = streamMetadata;
                        values =
                            DecodingUtils.decodeUnsignedRLELong(values, rleMetadata.runs(), rleMetadata.numRleValues());
                        return this.decodeLongZigZagDelta(values);
                    }
                    return this.decodeLongZigZagDelta(values);
                }
                case LogicalLevelTechnique.RLE: {
                    const rleMetadata = streamMetadata;
                    const decodedValues = this.decodeLongRLE(values, rleMetadata.runs());
                    return isSigned ? this.decodeZigZagLong(decodedValues) : decodedValues;
                }
                case LogicalLevelTechnique.NONE: {
                    return isSigned ? this.decodeZigZagLong(values) : values;
                }
                default:
                    throw new Error("The specified logical level technique is not supported for integers: " + streamMetadata.logicalLevelTechnique1());
            }
        }
        static decodeRLE(data, numRuns) {
            // Note: if this array is initialied like new Array<number>(numRleValues)
            // like the java implementation does, the array will potentially contain
            // extra uninitialized values
            const values = new Array();
            for (let i = 0; i < numRuns; i++) {
                const run = data[i];
                const value = data[i + numRuns];
                for (let j = 0; j < run; j++) {
                    values.push(value);
                }
            }
            return values;
        }
        static decodeLongRLE(data, numRuns) {
            // Note: if this array is initialied like new Array<number>(numRleValues)
            // like the java implementation does, the array will potentially contain
            // extra uninitialized values
            const values = new Array();
            for (let i = 0; i < numRuns; i++) {
                const run = data[i];
                const value = data[i + numRuns];
                for (let j = 0; j < run; j++) {
                    values.push(value);
                }
            }
            return values;
        }
        static decodeZigZagDelta(data) {
            const values = [];
            let previousValue = 0;
            for (const zigZagDelta of data) {
                const delta = DecodingUtils.decodeZigZag(zigZagDelta);
                const value = previousValue + delta;
                values.push(value);
                previousValue = value;
            }
            return values;
        }
        static decodeDelta(data) {
            const values = [];
            let previousValue = 0;
            for (const delta of data) {
                const value = previousValue + delta;
                values.push(value);
                previousValue = value;
            }
            return values;
        }
        static decodeLongZigZagDelta(data) {
            const values = [];
            let previousValue = BigInt(0);
            for (const zigZagDelta of data) {
                const delta = DecodingUtils.decodeZigZagLong(zigZagDelta);
                const value = previousValue + delta;
                values.push(value);
                previousValue = value;
            }
            return values;
        }
        static decodeZigZag(data) {
            return data.map(zigZagDelta => DecodingUtils.decodeZigZag(zigZagDelta));
        }
        static decodeZigZagLong(data) {
            return data.map(zigZagDelta => DecodingUtils.decodeZigZagLong(zigZagDelta));
        }
    }

    module.exports = Point;

    /**
     * A standalone point geometry with useful accessor, comparison, and
     * modification methods.
     *
     * @class Point
     * @param {Number} x the x-coordinate. this could be longitude or screen
     * pixels, or any other sort of unit.
     * @param {Number} y the y-coordinate. this could be latitude or screen
     * pixels, or any other sort of unit.
     * @example
     * var point = new Point(-77, 38);
     */
    function Point(x, y) {
        this.x = x;
        this.y = y;
    }

    Point.prototype = {

        /**
         * Clone this point, returning a new point that can be modified
         * without affecting the old one.
         * @return {Point} the clone
         */
        clone: function() { return new Point(this.x, this.y); },

        /**
         * Add this point's x & y coordinates to another point,
         * yielding a new point.
         * @param {Point} p the other point
         * @return {Point} output point
         */
        add:     function(p) { return this.clone()._add(p); },

        /**
         * Subtract this point's x & y coordinates to from point,
         * yielding a new point.
         * @param {Point} p the other point
         * @return {Point} output point
         */
        sub:     function(p) { return this.clone()._sub(p); },

        /**
         * Multiply this point's x & y coordinates by point,
         * yielding a new point.
         * @param {Point} p the other point
         * @return {Point} output point
         */
        multByPoint:    function(p) { return this.clone()._multByPoint(p); },

        /**
         * Divide this point's x & y coordinates by point,
         * yielding a new point.
         * @param {Point} p the other point
         * @return {Point} output point
         */
        divByPoint:     function(p) { return this.clone()._divByPoint(p); },

        /**
         * Multiply this point's x & y coordinates by a factor,
         * yielding a new point.
         * @param {Point} k factor
         * @return {Point} output point
         */
        mult:    function(k) { return this.clone()._mult(k); },

        /**
         * Divide this point's x & y coordinates by a factor,
         * yielding a new point.
         * @param {Point} k factor
         * @return {Point} output point
         */
        div:     function(k) { return this.clone()._div(k); },

        /**
         * Rotate this point around the 0, 0 origin by an angle a,
         * given in radians
         * @param {Number} a angle to rotate around, in radians
         * @return {Point} output point
         */
        rotate:  function(a) { return this.clone()._rotate(a); },

        /**
         * Rotate this point around p point by an angle a,
         * given in radians
         * @param {Number} a angle to rotate around, in radians
         * @param {Point} p Point to rotate around
         * @return {Point} output point
         */
        rotateAround:  function(a,p) { return this.clone()._rotateAround(a,p); },

        /**
         * Multiply this point by a 4x1 transformation matrix
         * @param {Array<Number>} m transformation matrix
         * @return {Point} output point
         */
        matMult: function(m) { return this.clone()._matMult(m); },

        /**
         * Calculate this point but as a unit vector from 0, 0, meaning
         * that the distance from the resulting point to the 0, 0
         * coordinate will be equal to 1 and the angle from the resulting
         * point to the 0, 0 coordinate will be the same as before.
         * @return {Point} unit vector point
         */
        unit:    function() { return this.clone()._unit(); },

        /**
         * Compute a perpendicular point, where the new y coordinate
         * is the old x coordinate and the new x coordinate is the old y
         * coordinate multiplied by -1
         * @return {Point} perpendicular point
         */
        perp:    function() { return this.clone()._perp(); },

        /**
         * Return a version of this point with the x & y coordinates
         * rounded to integers.
         * @return {Point} rounded point
         */
        round:   function() { return this.clone()._round(); },

        /**
         * Return the magitude of this point: this is the Euclidean
         * distance from the 0, 0 coordinate to this point's x and y
         * coordinates.
         * @return {Number} magnitude
         */
        mag: function() {
            return Math.sqrt(this.x * this.x + this.y * this.y);
        },

        /**
         * Judge whether this point is equal to another point, returning
         * true or false.
         * @param {Point} other the other point
         * @return {boolean} whether the points are equal
         */
        equals: function(other) {
            return this.x === other.x &&
                   this.y === other.y;
        },

        /**
         * Calculate the distance from this point to another point
         * @param {Point} p the other point
         * @return {Number} distance
         */
        dist: function(p) {
            return Math.sqrt(this.distSqr(p));
        },

        /**
         * Calculate the distance from this point to another point,
         * without the square root step. Useful if you're comparing
         * relative distances.
         * @param {Point} p the other point
         * @return {Number} distance
         */
        distSqr: function(p) {
            var dx = p.x - this.x,
                dy = p.y - this.y;
            return dx * dx + dy * dy;
        },

        /**
         * Get the angle from the 0, 0 coordinate to this point, in radians
         * coordinates.
         * @return {Number} angle
         */
        angle: function() {
            return Math.atan2(this.y, this.x);
        },

        /**
         * Get the angle from this point to another point, in radians
         * @param {Point} b the other point
         * @return {Number} angle
         */
        angleTo: function(b) {
            return Math.atan2(this.y - b.y, this.x - b.x);
        },

        /**
         * Get the angle between this point and another point, in radians
         * @param {Point} b the other point
         * @return {Number} angle
         */
        angleWith: function(b) {
            return this.angleWithSep(b.x, b.y);
        },

        /*
         * Find the angle of the two vectors, solving the formula for
         * the cross product a x b = |a||b|sin(θ) for θ.
         * @param {Number} x the x-coordinate
         * @param {Number} y the y-coordinate
         * @return {Number} the angle in radians
         */
        angleWithSep: function(x, y) {
            return Math.atan2(
                this.x * y - this.y * x,
                this.x * x + this.y * y);
        },

        _matMult: function(m) {
            var x = m[0] * this.x + m[1] * this.y,
                y = m[2] * this.x + m[3] * this.y;
            this.x = x;
            this.y = y;
            return this;
        },

        _add: function(p) {
            this.x += p.x;
            this.y += p.y;
            return this;
        },

        _sub: function(p) {
            this.x -= p.x;
            this.y -= p.y;
            return this;
        },

        _mult: function(k) {
            this.x *= k;
            this.y *= k;
            return this;
        },

        _div: function(k) {
            this.x /= k;
            this.y /= k;
            return this;
        },

        _multByPoint: function(p) {
            this.x *= p.x;
            this.y *= p.y;
            return this;
        },

        _divByPoint: function(p) {
            this.x /= p.x;
            this.y /= p.y;
            return this;
        },

        _unit: function() {
            this._div(this.mag());
            return this;
        },

        _perp: function() {
            var y = this.y;
            this.y = this.x;
            this.x = -y;
            return this;
        },

        _rotate: function(angle) {
            var cos = Math.cos(angle),
                sin = Math.sin(angle),
                x = cos * this.x - sin * this.y,
                y = sin * this.x + cos * this.y;
            this.x = x;
            this.y = y;
            return this;
        },

        _rotateAround: function(angle, p) {
            var cos = Math.cos(angle),
                sin = Math.sin(angle),
                x = p.x + cos * (this.x - p.x) - sin * (this.y - p.y),
                y = p.y + sin * (this.x - p.x) + cos * (this.y - p.y);
            this.x = x;
            this.y = y;
            return this;
        },

        _round: function() {
            this.x = Math.round(this.x);
            this.y = Math.round(this.y);
            return this;
        }
    };

    /**
     * Construct a point from an array if necessary, otherwise if the input
     * is already a Point, or an unknown type, return it unchanged
     * @param {Array<Number>|Point|*} a any kind of input value
     * @return {Point} constructed point, or passed-through value.
     * @example
     * // this
     * var point = Point.convert([0, 1]);
     * // is equivalent to
     * var point = new Point(0, 1);
     */
    Point.convert = function (a) {
        if (a instanceof Point) {
            return a;
        }
        if (Array.isArray(a)) {
            return new Point(a[0], a[1]);
        }
        return a;
    };

    var Point$1 = /*#__PURE__*/Object.freeze({
        __proto__: null
    });

    class Coordinate {
        constructor(x, y) {
            this.x = x;
            this.y = y;
        }
    }
    class LineString {
        constructor(points) {
            this.toGeoJSON = (extent, x, y, z) => {
                const projection = new Projection(extent, x, y, z);
                return {
                    "type": "LineString",
                    "coordinates": projection.project(this.points)
                };
            };
            this.loadGeometry = () => {
                return [this.points];
            };
            this.points = points;
        }
    }
    class MultiPoint {
        constructor(points) {
            this.toGeoJSON = (extent, x, y, z) => {
                const projection = new Projection(extent, x, y, z);
                return {
                    "type": "MultiPoint",
                    "coordinates": projection.project(this.points)
                };
            };
            this.loadGeometry = () => {
                return this.points.map(p => [p]);
            };
            this.points = points;
        }
    }
    class LinearRing {
        constructor(points) {
            this.toGeoJSON = (extent, x, y, z) => {
                const projection = new Projection(extent, x, y, z);
                return {
                    "type": "LineString",
                    "coordinates": projection.project(this.points)
                };
            };
            this.loadGeometry = () => {
                return [this.points];
            };
            this.points = points;
        }
    }
    class Polygon {
        constructor(shell, rings) {
            this.toGeoJSON = (extent, x, y, z) => {
                const projection = new Projection(extent, x, y, z);
                if (this.rings.length) {
                    const rings = [projection.project(this.shell.points)];
                    this.rings.forEach(ring => {
                        rings.push(projection.project(ring.points));
                    });
                    return {
                        "type": "Polygon",
                        "coordinates": rings
                    };
                }
                return {
                    "type": "Polygon",
                    "coordinates": [projection.project(this.shell.points)]
                };
            };
            this.loadGeometry = () => {
                if (this.rings.length) {
                    const rings = [this.shell.points];
                    this.rings.forEach(ring => {
                        rings.push(ring.points);
                    });
                    return rings;
                }
                return this.shell.loadGeometry();
            };
            this.shell = shell;
            this.rings = rings;
        }
    }
    class MultiLineString {
        constructor(lines) {
            this.toGeoJSON = (extent, x, y, z) => {
                const projection = new Projection(extent, x, y, z);
                const lines = [];
                for (const line of this.lines) {
                    lines.push(projection.project(line.points));
                }
                return {
                    "type": "MultiLineString",
                    "coordinates": lines
                };
            };
            this.loadGeometry = () => {
                const lines = [];
                for (const line of this.lines) {
                    lines.push(line.points);
                }
                return lines;
            };
            this.lines = lines;
        }
    }
    class MultiPolygon {
        constructor(polygons) {
            this.toGeoJSON = (extent, x, y, z) => {
                const projection = new Projection(extent, x, y, z);
                const polygons = [];
                for (const polygon of this.polygons) {
                    const poly = [projection.project(polygon.shell.points)];
                    if (polygon.rings.length) {
                        polygon.rings.forEach(ring => {
                            poly.push(projection.project(ring.points));
                        });
                    }
                    polygons.push(poly);
                }
                return {
                    "type": "MultiPolygon",
                    "coordinates": polygons
                };
            };
            this.loadGeometry = () => {
                const polygons = [];
                for (const polygon of this.polygons) {
                    polygons.push(polygon.shell.points);
                    polygon.rings.forEach(ring => {
                        polygons.push(ring.points);
                    });
                }
                return polygons;
            };
            this.polygons = polygons;
        }
    }
    class GeometryFactory {
        createPoint(coordinate) {
            return new Point$1(coordinate.x, coordinate.y);
        }
        createMultiPoint(points) {
            return new MultiPoint(points);
        }
        createLineString(vertices) {
            return new LineString(vertices);
        }
        createLinearRing(linearRing) {
            return new LinearRing(linearRing);
        }
        createPolygon(shell, rings) {
            return new Polygon(shell, rings);
        }
        createMultiLineString(lineStrings) {
            return new MultiLineString(lineStrings);
        }
        createMultiPolygon(polygons) {
            return new MultiPolygon(polygons);
        }
    }

    var GeometryType;
    (function (GeometryType) {
        GeometryType[GeometryType["POINT"] = 0] = "POINT";
        GeometryType[GeometryType["LINESTRING"] = 1] = "LINESTRING";
        GeometryType[GeometryType["POLYGON"] = 2] = "POLYGON";
        GeometryType[GeometryType["MULTIPOINT"] = 3] = "MULTIPOINT";
        GeometryType[GeometryType["MULTILINESTRING"] = 4] = "MULTILINESTRING";
        GeometryType[GeometryType["MULTIPOLYGON"] = 5] = "MULTIPOLYGON";
    })(GeometryType || (GeometryType = {}));
    class GeometryDecoder {
        static decodeGeometryColumn(tile, numStreams, offset) {
            const geometryTypeMetadata = StreamMetadataDecoder.decode(tile, offset);
            const geometryTypes = IntegerDecoder.decodeIntStream(tile, offset, geometryTypeMetadata, false);
            let numGeometries = null;
            let numParts = null;
            let numRings = null;
            let vertexOffsets = null;
            let vertexList = [];
            for (let i = 0; i < numStreams - 1; i++) {
                const geometryStreamMetadata = StreamMetadataDecoder.decode(tile, offset);
                const physicalStreamType = geometryStreamMetadata.physicalStreamType();
                switch (physicalStreamType) {
                    case PhysicalStreamType.LENGTH: {
                        switch (geometryStreamMetadata.logicalStreamType().lengthType()) {
                            case LengthType.GEOMETRIES:
                                numGeometries = IntegerDecoder.decodeIntStream(tile, offset, geometryStreamMetadata, false);
                                break;
                            case LengthType.PARTS:
                                numParts = IntegerDecoder.decodeIntStream(tile, offset, geometryStreamMetadata, false);
                                break;
                            case LengthType.RINGS:
                                numRings = IntegerDecoder.decodeIntStream(tile, offset, geometryStreamMetadata, false);
                                break;
                            case LengthType.TRIANGLES:
                                throw new Error("Not implemented yet.");
                        }
                        break;
                    }
                    case PhysicalStreamType.OFFSET: {
                        vertexOffsets = IntegerDecoder.decodeIntStream(tile, offset, geometryStreamMetadata, false);
                        break;
                    }
                    case PhysicalStreamType.DATA: {
                        if (DictionaryType.VERTEX === geometryStreamMetadata.logicalStreamType().dictionaryType()) {
                            if (geometryStreamMetadata.physicalLevelTechnique() == PhysicalLevelTechnique.FAST_PFOR) {
                                throw new Error("FastPfor encoding for geometries is not yet supported.");
                                // vertexBuffer = DecodingUtils.decodeFastPfor128DeltaCoordinates(tile, geometryStreamMetadata.numValues(),
                                // geometryStreamMetadata.byteLength(), offset);
                                // offset.set(offset.get() + geometryStreamMetadata.byteLength());
                            }
                            else {
                                vertexList = IntegerDecoder.decodeIntStream(tile, offset, geometryStreamMetadata, true);
                            }
                        }
                        else {
                            vertexList = IntegerDecoder.decodeMortonStream(tile, offset, geometryStreamMetadata);
                        }
                        break;
                    }
                }
            }
            return new GeometryColumn(geometryTypes, numGeometries, numParts, numRings, vertexOffsets, vertexList);
        }
        static decodeGeometry(geometryColumn) {
            const geometries = new Array(geometryColumn.geometryTypes.length);
            let partOffsetCounter = 0;
            let ringOffsetsCounter = 0;
            let geometryOffsetsCounter = 0;
            let geometryCounter = 0;
            const geometryFactory = new GeometryFactory();
            let vertexBufferOffset = 0;
            let vertexOffsetsOffset = 0;
            const geometryTypes = geometryColumn.geometryTypes;
            const geometryOffsets = geometryColumn.numGeometries;
            const partOffsets = geometryColumn.numParts;
            const ringOffsets = geometryColumn.numRings;
            const vertexOffsets = geometryColumn.vertexOffsets ? geometryColumn.vertexOffsets.map(i => i) : null;
            if (geometryColumn.vertexList.length === 0) {
                console.log("Warning: Vertex list is empty, skipping geometry decoding.");
                return [];
            }
            const vertexBuffer = geometryColumn.vertexList.map(i => i);
            const containsPolygon = geometryTypes.includes(GeometryType.POLYGON) || geometryTypes.includes(GeometryType.MULTIPOLYGON);
            for (const geometryTypeNum of geometryTypes) {
                const geometryType = geometryTypeNum;
                if (geometryType === GeometryType.POINT) {
                    if (!vertexOffsets || vertexOffsets.length === 0) {
                        const x = vertexBuffer[vertexBufferOffset++];
                        const y = vertexBuffer[vertexBufferOffset++];
                        const coordinate = new Coordinate(x, y);
                        geometries[geometryCounter++] = geometryFactory.createPoint(coordinate);
                    }
                    else {
                        const offset = vertexOffsets[vertexOffsetsOffset++] * 2;
                        const x = vertexBuffer[offset];
                        const y = vertexBuffer[offset + 1];
                        const coordinate = new Coordinate(x, y);
                        geometries[geometryCounter++] = geometryFactory.createPoint(coordinate);
                    }
                }
                else if (geometryType === GeometryType.MULTIPOINT) {
                    const numPoints = geometryOffsets[geometryOffsetsCounter++];
                    const points = new Array(numPoints);
                    if (!vertexOffsets || vertexOffsets.length === 0) {
                        for (let i = 0; i < numPoints; i++) {
                            const x = vertexBuffer[vertexBufferOffset++];
                            const y = vertexBuffer[vertexBufferOffset++];
                            const coordinate = new Coordinate(x, y);
                            points[i] = geometryFactory.createPoint(coordinate);
                        }
                        geometries[geometryCounter++] = geometryFactory.createMultiPoint(points);
                    }
                    else {
                        for (let i = 0; i < numPoints; i++) {
                            const offset = vertexOffsets[vertexOffsetsOffset++] * 2;
                            const x = vertexBuffer[offset];
                            const y = vertexBuffer[offset + 1];
                            const coordinate = new Coordinate(x, y);
                            points[i] = geometryFactory.createPoint(coordinate);
                        }
                        geometries[geometryCounter++] = geometryFactory.createMultiPoint(points);
                    }
                }
                else if (geometryType === GeometryType.LINESTRING) {
                    const numVertices = containsPolygon
                        ? ringOffsets[ringOffsetsCounter++]
                        : partOffsets[partOffsetCounter++];
                    if (!vertexOffsets || vertexOffsets.length === 0) {
                        const vertices = this.getLineString(vertexBuffer, vertexBufferOffset, numVertices, false);
                        vertexBufferOffset += numVertices * 2;
                        geometries[geometryCounter++] = geometryFactory.createLineString(vertices);
                    }
                    else {
                        const vertices = this.decodeDictionaryEncodedLineString(vertexBuffer, vertexOffsets, vertexOffsetsOffset, numVertices, false);
                        vertexOffsetsOffset += numVertices;
                        geometries[geometryCounter++] = geometryFactory.createLineString(vertices);
                    }
                }
                else if (geometryType === GeometryType.POLYGON) {
                    const numRings = partOffsets[partOffsetCounter++];
                    const rings = new Array(numRings - 1);
                    let numVertices = ringOffsets[ringOffsetsCounter++];
                    if (!vertexOffsets || vertexOffsets.length === 0) {
                        const shell = this.getLinearRing(vertexBuffer, vertexBufferOffset, numVertices, geometryFactory);
                        vertexBufferOffset += numVertices * 2;
                        for (let i = 0; i < rings.length; i++) {
                            numVertices = ringOffsets[ringOffsetsCounter++];
                            rings[i] = this.getLinearRing(vertexBuffer, vertexBufferOffset, numVertices, geometryFactory);
                            vertexBufferOffset += numVertices * 2;
                        }
                        geometries[geometryCounter++] = geometryFactory.createPolygon(shell, rings);
                    }
                    else {
                        const shell = this.decodeDictionaryEncodedLinearRing(vertexBuffer, vertexOffsets, vertexOffsetsOffset, numVertices, geometryFactory);
                        vertexOffsetsOffset += numVertices;
                        for (let i = 0; i < rings.length; i++) {
                            numVertices = ringOffsets[ringOffsetsCounter++];
                            rings[i] = this.decodeDictionaryEncodedLinearRing(vertexBuffer, vertexOffsets, vertexOffsetsOffset, numVertices, geometryFactory);
                            vertexOffsetsOffset += numVertices;
                        }
                        geometries[geometryCounter++] = geometryFactory.createPolygon(shell, rings);
                    }
                }
                else if (geometryType === GeometryType.MULTILINESTRING) {
                    const numLineStrings = geometryOffsets[geometryOffsetsCounter++];
                    const lineStrings = new Array(numLineStrings);
                    if (!vertexOffsets || vertexOffsets.length === 0) {
                        for (let i = 0; i < numLineStrings; i++) {
                            const numVertices = containsPolygon
                                ? ringOffsets[ringOffsetsCounter++] : partOffsets[partOffsetCounter++];
                            const vertices = this.getLineString(vertexBuffer, vertexBufferOffset, numVertices, false);
                            lineStrings[i] = geometryFactory.createLineString(vertices);
                            vertexBufferOffset += numVertices * 2;
                        }
                        geometries[geometryCounter++] = geometryFactory.createMultiLineString(lineStrings);
                    }
                    else {
                        for (let i = 0; i < numLineStrings; i++) {
                            const numVertices = containsPolygon
                                ? ringOffsets[ringOffsetsCounter++] : partOffsets[partOffsetCounter++];
                            const vertices = this.decodeDictionaryEncodedLineString(vertexBuffer, vertexOffsets, vertexOffsetsOffset, numVertices, false);
                            lineStrings[i] = geometryFactory.createLineString(vertices);
                            vertexOffsetsOffset += numVertices;
                        }
                        geometries[geometryCounter++] = geometryFactory.createMultiLineString(lineStrings);
                    }
                }
                else if (geometryType === GeometryType.MULTIPOLYGON) {
                    const numPolygons = geometryOffsets[geometryOffsetsCounter++];
                    const polygons = new Array(numPolygons);
                    if (!vertexOffsets || vertexOffsets.length === 0) {
                        for (let i = 0; i < numPolygons; i++) {
                            const numRings = partOffsets[partOffsetCounter++];
                            const rings = new Array(numRings - 1);
                            const numVertices = ringOffsets[ringOffsetsCounter++];
                            const shell = this.getLinearRing(vertexBuffer, vertexBufferOffset, numVertices, geometryFactory);
                            vertexBufferOffset += numVertices * 2;
                            for (let j = 0; j < rings.length; j++) {
                                const numRingVertices = ringOffsets[ringOffsetsCounter++];
                                rings[j] = this.getLinearRing(vertexBuffer, vertexBufferOffset, numRingVertices, geometryFactory);
                                vertexBufferOffset += numRingVertices * 2;
                            }
                            polygons[i] = geometryFactory.createPolygon(shell, rings);
                        }
                        geometries[geometryCounter++] = geometryFactory.createMultiPolygon(polygons);
                    }
                    else {
                        for (let i = 0; i < numPolygons; i++) {
                            const numRings = partOffsets[partOffsetCounter++];
                            const rings = new Array(numRings - 1);
                            const numVertices = ringOffsets[ringOffsetsCounter++];
                            const shell = this.decodeDictionaryEncodedLinearRing(vertexBuffer, vertexOffsets, vertexOffsetsOffset, numVertices, geometryFactory);
                            vertexOffsetsOffset += numVertices;
                            for (let j = 0; j < rings.length; j++) {
                                const numRingVertices = ringOffsets[ringOffsetsCounter++];
                                rings[j] = this.decodeDictionaryEncodedLinearRing(vertexBuffer, vertexOffsets, vertexOffsetsOffset, numVertices, geometryFactory);
                                vertexOffsetsOffset += numRingVertices;
                            }
                            polygons[i] = geometryFactory.createPolygon(shell, rings);
                        }
                        geometries[geometryCounter++] = geometryFactory.createMultiPolygon(polygons);
                    }
                }
                else {
                    throw new Error("The specified geometry type is currently not supported: " + geometryTypeNum);
                }
            }
            return geometries;
        }
        static getLinearRing(vertexBuffer, startIndex, numVertices, geometryFactory) {
            const linearRing = this.getLineString(vertexBuffer, startIndex, numVertices, true);
            return geometryFactory.createLinearRing(linearRing);
        }
        static decodeDictionaryEncodedLinearRing(vertexBuffer, vertexOffsets, vertexOffset, numVertices, geometryFactory) {
            const linearRing = this.decodeDictionaryEncodedLineString(vertexBuffer, vertexOffsets, vertexOffset, numVertices, true);
            return geometryFactory.createLinearRing(linearRing);
        }
        static getLineString(vertexBuffer, startIndex, numVertices, closeLineString) {
            const vertices = new Array(closeLineString ? numVertices + 1 : numVertices);
            for (let i = 0; i < numVertices * 2; i += 2) {
                const x = vertexBuffer[startIndex + i];
                const y = vertexBuffer[startIndex + i + 1];
                vertices[i / 2] = new Coordinate(x, y);
            }
            if (closeLineString) {
                vertices[vertices.length - 1] = vertices[0];
            }
            return vertices;
        }
        static decodeDictionaryEncodedLineString(vertexBuffer, vertexOffsets, vertexOffset, numVertices, closeLineString) {
            const vertices = new Array(closeLineString ? numVertices + 1 : numVertices);
            for (let i = 0; i < numVertices * 2; i += 2) {
                const offset = vertexOffsets[vertexOffset + i / 2] * 2;
                const x = vertexBuffer[offset];
                const y = vertexBuffer[offset + 1];
                vertices[i / 2] = new Coordinate(x, y);
            }
            if (closeLineString) {
                vertices[vertices.length - 1] = vertices[0];
            }
            return vertices;
        }
    }
    class GeometryColumn {
        constructor(geometryTypes, numGeometries, numParts, numRings, vertexOffsets, vertexList) {
            this.geometryTypes = geometryTypes;
            this.numGeometries = numGeometries;
            this.numParts = numParts;
            this.numRings = numRings;
            this.vertexOffsets = vertexOffsets;
            this.vertexList = vertexList;
        }
    }

    class FloatDecoder {
        constructor() { }
        static decodeFloatStream(data, offset, streamMetadata) {
            const values = DecodingUtils.decodeFloatsLE(data, offset, streamMetadata.numValues());
            const valuesList = new Float32Array(values.length);
            for (let i = 0; i < values.length; i++) {
                valuesList[i] = values[i];
            }
            return valuesList;
        }
    }

    class DoubleDecoder {
        static decodeDoubleStream(data, offset, streamMetadata) {
            return DecodingUtils.decodeDoublesLE(data, offset, streamMetadata.numValues());
        }
    }

    const textDecoder = new TextDecoder("utf-8");
    class StringDecoder {
        /*
         * String column layouts:
         * -> plain -> present, length, data
         * -> dictionary -> present, length, dictionary, data
         * -> fsst dictionary -> symbolTable, symbolLength, dictionary, length, present, data
         * */
        static decode(data, offset, numStreams, presentStream, numValues) {
            let dictionaryLengthStream = null;
            let offsetStream = null;
            const dataStream = null;
            let dictionaryStream = null;
            let symbolTableStream = null;
            for (let i = 0; i < numStreams; i++) {
                const streamMetadata = StreamMetadataDecoder.decode(data, offset);
                switch (streamMetadata.physicalStreamType()) {
                    case 'OFFSET': {
                        offsetStream = IntegerDecoder.decodeIntStream(data, offset, streamMetadata, false);
                        break;
                    }
                    case 'LENGTH': {
                        const ls = IntegerDecoder.decodeIntStream(data, offset, streamMetadata, false);
                        if (streamMetadata.logicalStreamType().lengthType() === 'DICTIONARY') {
                            dictionaryLengthStream = ls;
                        }
                        break;
                    }
                    case 'DATA': {
                        const ds = data.slice(offset.get(), offset.get() + streamMetadata.byteLength());
                        offset.add(streamMetadata.byteLength());
                        if (streamMetadata.logicalStreamType().dictionaryType() === 'SINGLE') {
                            dictionaryStream = ds;
                        }
                        else {
                            symbolTableStream = ds;
                        }
                        break;
                    }
                    default:
                        console.log("StringDecoder encountered unknown stream type: " + streamMetadata.physicalStreamType());
                        return;
                }
            }
            if (symbolTableStream) {
                throw new Error("TODO: FSST decoding for strings is not yet implemented");
            }
            else if (dictionaryStream) {
                return this.decodeDictionary(presentStream, dictionaryLengthStream, dictionaryStream, offsetStream, numValues);
            }
            else {
                return this.decodePlain(presentStream, dictionaryLengthStream, dataStream, numValues);
            }
        }
        static decodePlain(presentStream, lengthStream, utf8Values, numValues) {
            const decodedValues = [];
            let lengthOffset = 0;
            let strOffset = 0;
            for (let i = 0; i < numValues; i++) {
                const present = presentStream.get(i);
                if (present) {
                    const length = lengthStream[lengthOffset++];
                    const value = textDecoder.decode(utf8Values.slice(strOffset, strOffset + length));
                    decodedValues.push(value);
                    strOffset += length;
                }
                else {
                    decodedValues.push(null);
                }
            }
            return decodedValues;
        }
        static decodeDictionary(presentStream, lengthStream, utf8Values, dictionaryOffsets, numValues) {
            const dictionary = [];
            let dictionaryOffset = 0;
            for (const length of lengthStream) {
                const value = textDecoder.decode(utf8Values.slice(dictionaryOffset, dictionaryOffset + length));
                dictionary.push(value);
                dictionaryOffset += length;
            }
            const values = [];
            let offset = 0;
            for (let i = 0; i < numValues; i++) {
                const present = presentStream.get(i);
                if (present) {
                    const value = dictionary[dictionaryOffsets[offset++]];
                    values.push(value);
                }
                else {
                    values.push(null);
                }
            }
            return values;
        }
    }

    // Copyright 2021-2024 Buf Technologies, Inc.
    //
    // Licensed under the Apache License, Version 2.0 (the "License");
    // you may not use this file except in compliance with the License.
    // You may obtain a copy of the License at
    //
    //      http://www.apache.org/licenses/LICENSE-2.0
    //
    // Unless required by applicable law or agreed to in writing, software
    // distributed under the License is distributed on an "AS IS" BASIS,
    // WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
    // See the License for the specific language governing permissions and
    // limitations under the License.
    /**
     * Assert that condition is truthy or throw error (with message)
     */
    function assert(condition, msg) {
        // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions -- we want the implicit conversion to boolean
        if (!condition) {
            throw new Error(msg);
        }
    }
    const FLOAT32_MAX = 3.4028234663852886e38, FLOAT32_MIN = -3.4028234663852886e38, UINT32_MAX = 0xffffffff, INT32_MAX = 0x7fffffff, INT32_MIN = -0x80000000;
    /**
     * Assert a valid signed protobuf 32-bit integer.
     */
    function assertInt32(arg) {
        if (typeof arg !== "number")
            throw new Error("invalid int 32: " + typeof arg);
        if (!Number.isInteger(arg) || arg > INT32_MAX || arg < INT32_MIN)
            throw new Error("invalid int 32: " + arg); // eslint-disable-line @typescript-eslint/restrict-plus-operands -- we want the implicit conversion to string
    }
    /**
     * Assert a valid unsigned protobuf 32-bit integer.
     */
    function assertUInt32(arg) {
        if (typeof arg !== "number")
            throw new Error("invalid uint 32: " + typeof arg);
        if (!Number.isInteger(arg) || arg > UINT32_MAX || arg < 0)
            throw new Error("invalid uint 32: " + arg); // eslint-disable-line @typescript-eslint/restrict-plus-operands -- we want the implicit conversion to string
    }
    /**
     * Assert a valid protobuf float value.
     */
    function assertFloat32(arg) {
        if (typeof arg !== "number")
            throw new Error("invalid float 32: " + typeof arg);
        if (!Number.isFinite(arg))
            return;
        if (arg > FLOAT32_MAX || arg < FLOAT32_MIN)
            throw new Error("invalid float 32: " + arg); // eslint-disable-line @typescript-eslint/restrict-plus-operands -- we want the implicit conversion to string
    }

    // Copyright 2021-2024 Buf Technologies, Inc.
    //
    // Licensed under the Apache License, Version 2.0 (the "License");
    // you may not use this file except in compliance with the License.
    // You may obtain a copy of the License at
    //
    //      http://www.apache.org/licenses/LICENSE-2.0
    //
    // Unless required by applicable law or agreed to in writing, software
    // distributed under the License is distributed on an "AS IS" BASIS,
    // WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
    // See the License for the specific language governing permissions and
    // limitations under the License.
    const enumTypeSymbol = Symbol("@bufbuild/protobuf/enum-type");
    /**
     * Get reflection information from a generated enum.
     * If this function is called on something other than a generated
     * enum, it raises an error.
     */
    function getEnumType(enumObject) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-assignment,@typescript-eslint/no-explicit-any
        const t = enumObject[enumTypeSymbol];
        assert(t, "missing enum type on enum object");
        return t; // eslint-disable-line @typescript-eslint/no-unsafe-return
    }
    /**
     * Sets reflection information on a generated enum.
     */
    function setEnumType(enumObject, typeName, values, opt) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any
        enumObject[enumTypeSymbol] = makeEnumType(typeName, values.map((v) => ({
            no: v.no,
            name: v.name,
            localName: enumObject[v.no],
        })));
    }
    /**
     * Create a new EnumType with the given values.
     */
    function makeEnumType(typeName, values, 
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _opt) {
        const names = Object.create(null);
        const numbers = Object.create(null);
        const normalValues = [];
        for (const value of values) {
            // We do not surface options at this time
            // const value: EnumValueInfo = {...v, options: v.options ?? emptyReadonlyObject};
            const n = normalizeEnumValue(value);
            normalValues.push(n);
            names[value.name] = n;
            numbers[value.no] = n;
        }
        return {
            typeName,
            values: normalValues,
            // We do not surface options at this time
            // options: opt?.options ?? Object.create(null),
            findName(name) {
                return names[name];
            },
            findNumber(no) {
                return numbers[no];
            },
        };
    }
    /**
     * Create a new enum object with the given values.
     * Sets reflection information.
     */
    function makeEnum(typeName, values, opt) {
        const enumObject = {};
        for (const value of values) {
            const n = normalizeEnumValue(value);
            enumObject[n.localName] = n.no;
            enumObject[n.no] = n.localName;
        }
        setEnumType(enumObject, typeName, values);
        return enumObject;
    }
    function normalizeEnumValue(value) {
        if ("localName" in value) {
            return value;
        }
        return Object.assign(Object.assign({}, value), { localName: value.name });
    }

    // Copyright 2021-2024 Buf Technologies, Inc.
    //
    // Licensed under the Apache License, Version 2.0 (the "License");
    // you may not use this file except in compliance with the License.
    // You may obtain a copy of the License at
    //
    //      http://www.apache.org/licenses/LICENSE-2.0
    //
    // Unless required by applicable law or agreed to in writing, software
    // distributed under the License is distributed on an "AS IS" BASIS,
    // WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
    // See the License for the specific language governing permissions and
    // limitations under the License.
    /**
     * Message is the base class of every message, generated, or created at
     * runtime.
     *
     * It is _not_ safe to extend this class. If you want to create a message at
     * run time, use proto3.makeMessageType().
     */
    class Message {
        /**
         * Compare with a message of the same type.
         * Note that this function disregards extensions and unknown fields.
         */
        equals(other) {
            return this.getType().runtime.util.equals(this.getType(), this, other);
        }
        /**
         * Create a deep copy.
         */
        clone() {
            return this.getType().runtime.util.clone(this);
        }
        /**
         * Parse from binary data, merging fields.
         *
         * Repeated fields are appended. Map entries are added, overwriting
         * existing keys.
         *
         * If a message field is already present, it will be merged with the
         * new data.
         */
        fromBinary(bytes, options) {
            const type = this.getType(), format = type.runtime.bin, opt = format.makeReadOptions(options);
            format.readMessage(this, opt.readerFactory(bytes), bytes.byteLength, opt);
            return this;
        }
        /**
         * Parse a message from a JSON value.
         */
        fromJson(jsonValue, options) {
            const type = this.getType(), format = type.runtime.json, opt = format.makeReadOptions(options);
            format.readMessage(type, jsonValue, opt, this);
            return this;
        }
        /**
         * Parse a message from a JSON string.
         */
        fromJsonString(jsonString, options) {
            let json;
            try {
                json = JSON.parse(jsonString);
            }
            catch (e) {
                throw new Error(`cannot decode ${this.getType().typeName} from JSON: ${e instanceof Error ? e.message : String(e)}`);
            }
            return this.fromJson(json, options);
        }
        /**
         * Serialize the message to binary data.
         */
        toBinary(options) {
            const type = this.getType(), bin = type.runtime.bin, opt = bin.makeWriteOptions(options), writer = opt.writerFactory();
            bin.writeMessage(this, writer, opt);
            return writer.finish();
        }
        /**
         * Serialize the message to a JSON value, a JavaScript value that can be
         * passed to JSON.stringify().
         */
        toJson(options) {
            const type = this.getType(), json = type.runtime.json, opt = json.makeWriteOptions(options);
            return json.writeMessage(this, opt);
        }
        /**
         * Serialize the message to a JSON string.
         */
        toJsonString(options) {
            var _a;
            const value = this.toJson(options);
            return JSON.stringify(value, null, (_a = options === null || options === void 0 ? void 0 : options.prettySpaces) !== null && _a !== void 0 ? _a : 0);
        }
        /**
         * Override for serialization behavior. This will be invoked when calling
         * JSON.stringify on this message (i.e. JSON.stringify(msg)).
         *
         * Note that this will not serialize google.protobuf.Any with a packed
         * message because the protobuf JSON format specifies that it needs to be
         * unpacked, and this is only possible with a type registry to look up the
         * message type.  As a result, attempting to serialize a message with this
         * type will throw an Error.
         *
         * This method is protected because you should not need to invoke it
         * directly -- instead use JSON.stringify or toJsonString for
         * stringified JSON.  Alternatively, if actual JSON is desired, you should
         * use toJson.
         */
        toJSON() {
            return this.toJson({
                emitDefaultValues: true,
            });
        }
        /**
         * Retrieve the MessageType of this message - a singleton that represents
         * the protobuf message declaration and provides metadata for reflection-
         * based operations.
         */
        getType() {
            // Any class that extends Message _must_ provide a complete static
            // implementation of MessageType.
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-return
            return Object.getPrototypeOf(this).constructor;
        }
    }

    // Copyright 2021-2024 Buf Technologies, Inc.
    //
    // Licensed under the Apache License, Version 2.0 (the "License");
    // you may not use this file except in compliance with the License.
    // You may obtain a copy of the License at
    //
    //      http://www.apache.org/licenses/LICENSE-2.0
    //
    // Unless required by applicable law or agreed to in writing, software
    // distributed under the License is distributed on an "AS IS" BASIS,
    // WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
    // See the License for the specific language governing permissions and
    // limitations under the License.
    /**
     * Create a new message type using the given runtime.
     */
    function makeMessageType(runtime, typeName, fields, opt) {
        var _a;
        const localName = (_a = opt === null || opt === void 0 ? void 0 : opt.localName) !== null && _a !== void 0 ? _a : typeName.substring(typeName.lastIndexOf(".") + 1);
        const type = {
            [localName]: function (data) {
                runtime.util.initFields(this);
                runtime.util.initPartial(data, this);
            },
        }[localName];
        Object.setPrototypeOf(type.prototype, new Message());
        Object.assign(type, {
            runtime,
            typeName,
            fields: runtime.util.newFieldList(fields),
            fromBinary(bytes, options) {
                return new type().fromBinary(bytes, options);
            },
            fromJson(jsonValue, options) {
                return new type().fromJson(jsonValue, options);
            },
            fromJsonString(jsonString, options) {
                return new type().fromJsonString(jsonString, options);
            },
            equals(a, b) {
                return runtime.util.equals(type, a, b);
            },
        });
        return type;
    }

    var global$1 = (typeof global !== "undefined" ? global :
      typeof self !== "undefined" ? self :
      typeof window !== "undefined" ? window : {});

    // shim for using process in browser
    // based off https://github.com/defunctzombie/node-process/blob/master/browser.js

    function defaultSetTimout() {
        throw new Error('setTimeout has not been defined');
    }
    function defaultClearTimeout () {
        throw new Error('clearTimeout has not been defined');
    }
    var cachedSetTimeout = defaultSetTimout;
    var cachedClearTimeout = defaultClearTimeout;
    if (typeof global$1.setTimeout === 'function') {
        cachedSetTimeout = setTimeout;
    }
    if (typeof global$1.clearTimeout === 'function') {
        cachedClearTimeout = clearTimeout;
    }

    function runTimeout(fun) {
        if (cachedSetTimeout === setTimeout) {
            //normal enviroments in sane situations
            return setTimeout(fun, 0);
        }
        // if setTimeout wasn't available but was latter defined
        if ((cachedSetTimeout === defaultSetTimout || !cachedSetTimeout) && setTimeout) {
            cachedSetTimeout = setTimeout;
            return setTimeout(fun, 0);
        }
        try {
            // when when somebody has screwed with setTimeout but no I.E. maddness
            return cachedSetTimeout(fun, 0);
        } catch(e){
            try {
                // When we are in I.E. but the script has been evaled so I.E. doesn't trust the global object when called normally
                return cachedSetTimeout.call(null, fun, 0);
            } catch(e){
                // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error
                return cachedSetTimeout.call(this, fun, 0);
            }
        }


    }
    function runClearTimeout(marker) {
        if (cachedClearTimeout === clearTimeout) {
            //normal enviroments in sane situations
            return clearTimeout(marker);
        }
        // if clearTimeout wasn't available but was latter defined
        if ((cachedClearTimeout === defaultClearTimeout || !cachedClearTimeout) && clearTimeout) {
            cachedClearTimeout = clearTimeout;
            return clearTimeout(marker);
        }
        try {
            // when when somebody has screwed with setTimeout but no I.E. maddness
            return cachedClearTimeout(marker);
        } catch (e){
            try {
                // When we are in I.E. but the script has been evaled so I.E. doesn't  trust the global object when called normally
                return cachedClearTimeout.call(null, marker);
            } catch (e){
                // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error.
                // Some versions of I.E. have different rules for clearTimeout vs setTimeout
                return cachedClearTimeout.call(this, marker);
            }
        }



    }
    var queue = [];
    var draining = false;
    var currentQueue;
    var queueIndex = -1;

    function cleanUpNextTick() {
        if (!draining || !currentQueue) {
            return;
        }
        draining = false;
        if (currentQueue.length) {
            queue = currentQueue.concat(queue);
        } else {
            queueIndex = -1;
        }
        if (queue.length) {
            drainQueue();
        }
    }

    function drainQueue() {
        if (draining) {
            return;
        }
        var timeout = runTimeout(cleanUpNextTick);
        draining = true;

        var len = queue.length;
        while(len) {
            currentQueue = queue;
            queue = [];
            while (++queueIndex < len) {
                if (currentQueue) {
                    currentQueue[queueIndex].run();
                }
            }
            queueIndex = -1;
            len = queue.length;
        }
        currentQueue = null;
        draining = false;
        runClearTimeout(timeout);
    }
    function nextTick(fun) {
        var args = new Array(arguments.length - 1);
        if (arguments.length > 1) {
            for (var i = 1; i < arguments.length; i++) {
                args[i - 1] = arguments[i];
            }
        }
        queue.push(new Item(fun, args));
        if (queue.length === 1 && !draining) {
            runTimeout(drainQueue);
        }
    }
    // v8 likes predictible objects
    function Item(fun, array) {
        this.fun = fun;
        this.array = array;
    }
    Item.prototype.run = function () {
        this.fun.apply(null, this.array);
    };
    var title = 'browser';
    var platform = 'browser';
    var browser = true;
    var env = {};
    var argv = [];
    var version = ''; // empty string to avoid regexp issues
    var versions = {};
    var release = {};
    var config = {};

    function noop() {}

    var on = noop;
    var addListener = noop;
    var once = noop;
    var off = noop;
    var removeListener = noop;
    var removeAllListeners = noop;
    var emit = noop;

    function binding(name) {
        throw new Error('process.binding is not supported');
    }

    function cwd () { return '/' }
    function chdir (dir) {
        throw new Error('process.chdir is not supported');
    }function umask() { return 0; }

    // from https://github.com/kumavis/browser-process-hrtime/blob/master/index.js
    var performance = global$1.performance || {};
    var performanceNow =
      performance.now        ||
      performance.mozNow     ||
      performance.msNow      ||
      performance.oNow       ||
      performance.webkitNow  ||
      function(){ return (new Date()).getTime() };

    // generate timestamp or delta
    // see http://nodejs.org/api/process.html#process_process_hrtime
    function hrtime(previousTimestamp){
      var clocktime = performanceNow.call(performance)*1e-3;
      var seconds = Math.floor(clocktime);
      var nanoseconds = Math.floor((clocktime%1)*1e9);
      if (previousTimestamp) {
        seconds = seconds - previousTimestamp[0];
        nanoseconds = nanoseconds - previousTimestamp[1];
        if (nanoseconds<0) {
          seconds--;
          nanoseconds += 1e9;
        }
      }
      return [seconds,nanoseconds]
    }

    var startTime = new Date();
    function uptime() {
      var currentTime = new Date();
      var dif = currentTime - startTime;
      return dif / 1000;
    }

    var browser$1 = {
      nextTick: nextTick,
      title: title,
      browser: browser,
      env: env,
      argv: argv,
      version: version,
      versions: versions,
      on: on,
      addListener: addListener,
      once: once,
      off: off,
      removeListener: removeListener,
      removeAllListeners: removeAllListeners,
      emit: emit,
      binding: binding,
      cwd: cwd,
      chdir: chdir,
      umask: umask,
      hrtime: hrtime,
      platform: platform,
      release: release,
      config: config,
      uptime: uptime
    };

    // Copyright 2008 Google Inc.  All rights reserved.
    //
    // Redistribution and use in source and binary forms, with or without
    // modification, are permitted provided that the following conditions are
    // met:
    //
    // * Redistributions of source code must retain the above copyright
    // notice, this list of conditions and the following disclaimer.
    // * Redistributions in binary form must reproduce the above
    // copyright notice, this list of conditions and the following disclaimer
    // in the documentation and/or other materials provided with the
    // distribution.
    // * Neither the name of Google Inc. nor the names of its
    // contributors may be used to endorse or promote products derived from
    // this software without specific prior written permission.
    //
    // THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS
    // "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT
    // LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR
    // A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT
    // OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
    // SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT
    // LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
    // DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY
    // THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
    // (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
    // OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
    //
    // Code generated by the Protocol Buffer compiler is owned by the owner
    // of the input file used when generating it.  This code is not
    // standalone and requires a support library to be linked with it.  This
    // support library is itself covered by the above license.
    /* eslint-disable prefer-const,@typescript-eslint/restrict-plus-operands */
    /**
     * Read a 64 bit varint as two JS numbers.
     *
     * Returns tuple:
     * [0]: low bits
     * [1]: high bits
     *
     * Copyright 2008 Google Inc.  All rights reserved.
     *
     * See https://github.com/protocolbuffers/protobuf/blob/8a71927d74a4ce34efe2d8769fda198f52d20d12/js/experimental/runtime/kernel/buffer_decoder.js#L175
     */
    function varint64read() {
        let lowBits = 0;
        let highBits = 0;
        for (let shift = 0; shift < 28; shift += 7) {
            let b = this.buf[this.pos++];
            lowBits |= (b & 0x7f) << shift;
            if ((b & 0x80) == 0) {
                this.assertBounds();
                return [lowBits, highBits];
            }
        }
        let middleByte = this.buf[this.pos++];
        // last four bits of the first 32 bit number
        lowBits |= (middleByte & 0x0f) << 28;
        // 3 upper bits are part of the next 32 bit number
        highBits = (middleByte & 0x70) >> 4;
        if ((middleByte & 0x80) == 0) {
            this.assertBounds();
            return [lowBits, highBits];
        }
        for (let shift = 3; shift <= 31; shift += 7) {
            let b = this.buf[this.pos++];
            highBits |= (b & 0x7f) << shift;
            if ((b & 0x80) == 0) {
                this.assertBounds();
                return [lowBits, highBits];
            }
        }
        throw new Error("invalid varint");
    }
    /**
     * Write a 64 bit varint, given as two JS numbers, to the given bytes array.
     *
     * Copyright 2008 Google Inc.  All rights reserved.
     *
     * See https://github.com/protocolbuffers/protobuf/blob/8a71927d74a4ce34efe2d8769fda198f52d20d12/js/experimental/runtime/kernel/writer.js#L344
     */
    function varint64write(lo, hi, bytes) {
        for (let i = 0; i < 28; i = i + 7) {
            const shift = lo >>> i;
            const hasNext = !(shift >>> 7 == 0 && hi == 0);
            const byte = (hasNext ? shift | 0x80 : shift) & 0xff;
            bytes.push(byte);
            if (!hasNext) {
                return;
            }
        }
        const splitBits = ((lo >>> 28) & 0x0f) | ((hi & 0x07) << 4);
        const hasMoreBits = !(hi >> 3 == 0);
        bytes.push((hasMoreBits ? splitBits | 0x80 : splitBits) & 0xff);
        if (!hasMoreBits) {
            return;
        }
        for (let i = 3; i < 31; i = i + 7) {
            const shift = hi >>> i;
            const hasNext = !(shift >>> 7 == 0);
            const byte = (hasNext ? shift | 0x80 : shift) & 0xff;
            bytes.push(byte);
            if (!hasNext) {
                return;
            }
        }
        bytes.push((hi >>> 31) & 0x01);
    }
    // constants for binary math
    const TWO_PWR_32_DBL = 0x100000000;
    /**
     * Parse decimal string of 64 bit integer value as two JS numbers.
     *
     * Copyright 2008 Google Inc.  All rights reserved.
     *
     * See https://github.com/protocolbuffers/protobuf-javascript/blob/a428c58273abad07c66071d9753bc4d1289de426/experimental/runtime/int64.js#L10
     */
    function int64FromString(dec) {
        // Check for minus sign.
        const minus = dec[0] === "-";
        if (minus) {
            dec = dec.slice(1);
        }
        // Work 6 decimal digits at a time, acting like we're converting base 1e6
        // digits to binary. This is safe to do with floating point math because
        // Number.isSafeInteger(ALL_32_BITS * 1e6) == true.
        const base = 1e6;
        let lowBits = 0;
        let highBits = 0;
        function add1e6digit(begin, end) {
            // Note: Number('') is 0.
            const digit1e6 = Number(dec.slice(begin, end));
            highBits *= base;
            lowBits = lowBits * base + digit1e6;
            // Carry bits from lowBits to
            if (lowBits >= TWO_PWR_32_DBL) {
                highBits = highBits + ((lowBits / TWO_PWR_32_DBL) | 0);
                lowBits = lowBits % TWO_PWR_32_DBL;
            }
        }
        add1e6digit(-24, -18);
        add1e6digit(-18, -12);
        add1e6digit(-12, -6);
        add1e6digit(-6);
        return minus ? negate(lowBits, highBits) : newBits(lowBits, highBits);
    }
    /**
     * Losslessly converts a 64-bit signed integer in 32:32 split representation
     * into a decimal string.
     *
     * Copyright 2008 Google Inc.  All rights reserved.
     *
     * See https://github.com/protocolbuffers/protobuf-javascript/blob/a428c58273abad07c66071d9753bc4d1289de426/experimental/runtime/int64.js#L10
     */
    function int64ToString(lo, hi) {
        let bits = newBits(lo, hi);
        // If we're treating the input as a signed value and the high bit is set, do
        // a manual two's complement conversion before the decimal conversion.
        const negative = (bits.hi & 0x80000000);
        if (negative) {
            bits = negate(bits.lo, bits.hi);
        }
        const result = uInt64ToString(bits.lo, bits.hi);
        return negative ? "-" + result : result;
    }
    /**
     * Losslessly converts a 64-bit unsigned integer in 32:32 split representation
     * into a decimal string.
     *
     * Copyright 2008 Google Inc.  All rights reserved.
     *
     * See https://github.com/protocolbuffers/protobuf-javascript/blob/a428c58273abad07c66071d9753bc4d1289de426/experimental/runtime/int64.js#L10
     */
    function uInt64ToString(lo, hi) {
        ({ lo, hi } = toUnsigned(lo, hi));
        // Skip the expensive conversion if the number is small enough to use the
        // built-in conversions.
        // Number.MAX_SAFE_INTEGER = 0x001FFFFF FFFFFFFF, thus any number with
        // highBits <= 0x1FFFFF can be safely expressed with a double and retain
        // integer precision.
        // Proven by: Number.isSafeInteger(0x1FFFFF * 2**32 + 0xFFFFFFFF) == true.
        if (hi <= 0x1FFFFF) {
            return String(TWO_PWR_32_DBL * hi + lo);
        }
        // What this code is doing is essentially converting the input number from
        // base-2 to base-1e7, which allows us to represent the 64-bit range with
        // only 3 (very large) digits. Those digits are then trivial to convert to
        // a base-10 string.
        // The magic numbers used here are -
        // 2^24 = 16777216 = (1,6777216) in base-1e7.
        // 2^48 = 281474976710656 = (2,8147497,6710656) in base-1e7.
        // Split 32:32 representation into 16:24:24 representation so our
        // intermediate digits don't overflow.
        const low = lo & 0xFFFFFF;
        const mid = ((lo >>> 24) | (hi << 8)) & 0xFFFFFF;
        const high = (hi >> 16) & 0xFFFF;
        // Assemble our three base-1e7 digits, ignoring carries. The maximum
        // value in a digit at this step is representable as a 48-bit integer, which
        // can be stored in a 64-bit floating point number.
        let digitA = low + (mid * 6777216) + (high * 6710656);
        let digitB = mid + (high * 8147497);
        let digitC = (high * 2);
        // Apply carries from A to B and from B to C.
        const base = 10000000;
        if (digitA >= base) {
            digitB += Math.floor(digitA / base);
            digitA %= base;
        }
        if (digitB >= base) {
            digitC += Math.floor(digitB / base);
            digitB %= base;
        }
        // If digitC is 0, then we should have returned in the trivial code path
        // at the top for non-safe integers. Given this, we can assume both digitB
        // and digitA need leading zeros.
        return digitC.toString() + decimalFrom1e7WithLeadingZeros(digitB) +
            decimalFrom1e7WithLeadingZeros(digitA);
    }
    function toUnsigned(lo, hi) {
        return { lo: lo >>> 0, hi: hi >>> 0 };
    }
    function newBits(lo, hi) {
        return { lo: lo | 0, hi: hi | 0 };
    }
    /**
     * Returns two's compliment negation of input.
     * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Bitwise_Operators#Signed_32-bit_integers
     */
    function negate(lowBits, highBits) {
        highBits = ~highBits;
        if (lowBits) {
            lowBits = ~lowBits + 1;
        }
        else {
            // If lowBits is 0, then bitwise-not is 0xFFFFFFFF,
            // adding 1 to that, results in 0x100000000, which leaves
            // the low bits 0x0 and simply adds one to the high bits.
            highBits += 1;
        }
        return newBits(lowBits, highBits);
    }
    /**
     * Returns decimal representation of digit1e7 with leading zeros.
     */
    const decimalFrom1e7WithLeadingZeros = (digit1e7) => {
        const partial = String(digit1e7);
        return "0000000".slice(partial.length) + partial;
    };
    /**
     * Write a 32 bit varint, signed or unsigned. Same as `varint64write(0, value, bytes)`
     *
     * Copyright 2008 Google Inc.  All rights reserved.
     *
     * See https://github.com/protocolbuffers/protobuf/blob/1b18833f4f2a2f681f4e4a25cdf3b0a43115ec26/js/binary/encoder.js#L144
     */
    function varint32write(value, bytes) {
        if (value >= 0) {
            // write value as varint 32
            while (value > 0x7f) {
                bytes.push((value & 0x7f) | 0x80);
                value = value >>> 7;
            }
            bytes.push(value);
        }
        else {
            for (let i = 0; i < 9; i++) {
                bytes.push((value & 127) | 128);
                value = value >> 7;
            }
            bytes.push(1);
        }
    }
    /**
     * Read an unsigned 32 bit varint.
     *
     * See https://github.com/protocolbuffers/protobuf/blob/8a71927d74a4ce34efe2d8769fda198f52d20d12/js/experimental/runtime/kernel/buffer_decoder.js#L220
     */
    function varint32read() {
        let b = this.buf[this.pos++];
        let result = b & 0x7f;
        if ((b & 0x80) == 0) {
            this.assertBounds();
            return result;
        }
        b = this.buf[this.pos++];
        result |= (b & 0x7f) << 7;
        if ((b & 0x80) == 0) {
            this.assertBounds();
            return result;
        }
        b = this.buf[this.pos++];
        result |= (b & 0x7f) << 14;
        if ((b & 0x80) == 0) {
            this.assertBounds();
            return result;
        }
        b = this.buf[this.pos++];
        result |= (b & 0x7f) << 21;
        if ((b & 0x80) == 0) {
            this.assertBounds();
            return result;
        }
        // Extract only last 4 bits
        b = this.buf[this.pos++];
        result |= (b & 0x0f) << 28;
        for (let readBytes = 5; (b & 0x80) !== 0 && readBytes < 10; readBytes++)
            b = this.buf[this.pos++];
        if ((b & 0x80) != 0)
            throw new Error("invalid varint");
        this.assertBounds();
        // Result can have 32 bits, convert it to unsigned
        return result >>> 0;
    }

    function makeInt64Support() {
        const dv = new DataView(new ArrayBuffer(8));
        // note that Safari 14 implements BigInt, but not the DataView methods
        const ok = typeof BigInt === "function" &&
            typeof dv.getBigInt64 === "function" &&
            typeof dv.getBigUint64 === "function" &&
            typeof dv.setBigInt64 === "function" &&
            typeof dv.setBigUint64 === "function" &&
            (typeof browser$1 != "object" ||
                typeof browser$1.env != "object" ||
                browser$1.env.BUF_BIGINT_DISABLE !== "1");
        if (ok) {
            const MIN = BigInt("-9223372036854775808"), MAX = BigInt("9223372036854775807"), UMIN = BigInt("0"), UMAX = BigInt("18446744073709551615");
            return {
                zero: BigInt(0),
                supported: true,
                parse(value) {
                    const bi = typeof value == "bigint" ? value : BigInt(value);
                    if (bi > MAX || bi < MIN) {
                        throw new Error(`int64 invalid: ${value}`);
                    }
                    return bi;
                },
                uParse(value) {
                    const bi = typeof value == "bigint" ? value : BigInt(value);
                    if (bi > UMAX || bi < UMIN) {
                        throw new Error(`uint64 invalid: ${value}`);
                    }
                    return bi;
                },
                enc(value) {
                    dv.setBigInt64(0, this.parse(value), true);
                    return {
                        lo: dv.getInt32(0, true),
                        hi: dv.getInt32(4, true),
                    };
                },
                uEnc(value) {
                    dv.setBigInt64(0, this.uParse(value), true);
                    return {
                        lo: dv.getInt32(0, true),
                        hi: dv.getInt32(4, true),
                    };
                },
                dec(lo, hi) {
                    dv.setInt32(0, lo, true);
                    dv.setInt32(4, hi, true);
                    return dv.getBigInt64(0, true);
                },
                uDec(lo, hi) {
                    dv.setInt32(0, lo, true);
                    dv.setInt32(4, hi, true);
                    return dv.getBigUint64(0, true);
                },
            };
        }
        const assertInt64String = (value) => assert(/^-?[0-9]+$/.test(value), `int64 invalid: ${value}`);
        const assertUInt64String = (value) => assert(/^[0-9]+$/.test(value), `uint64 invalid: ${value}`);
        return {
            zero: "0",
            supported: false,
            parse(value) {
                if (typeof value != "string") {
                    value = value.toString();
                }
                assertInt64String(value);
                return value;
            },
            uParse(value) {
                if (typeof value != "string") {
                    value = value.toString();
                }
                assertUInt64String(value);
                return value;
            },
            enc(value) {
                if (typeof value != "string") {
                    value = value.toString();
                }
                assertInt64String(value);
                return int64FromString(value);
            },
            uEnc(value) {
                if (typeof value != "string") {
                    value = value.toString();
                }
                assertUInt64String(value);
                return int64FromString(value);
            },
            dec(lo, hi) {
                return int64ToString(lo, hi);
            },
            uDec(lo, hi) {
                return uInt64ToString(lo, hi);
            },
        };
    }
    const protoInt64 = makeInt64Support();

    // Copyright 2021-2024 Buf Technologies, Inc.
    //
    // Licensed under the Apache License, Version 2.0 (the "License");
    // you may not use this file except in compliance with the License.
    // You may obtain a copy of the License at
    //
    //      http://www.apache.org/licenses/LICENSE-2.0
    //
    // Unless required by applicable law or agreed to in writing, software
    // distributed under the License is distributed on an "AS IS" BASIS,
    // WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
    // See the License for the specific language governing permissions and
    // limitations under the License.
    /**
     * Scalar value types. This is a subset of field types declared by protobuf
     * enum google.protobuf.FieldDescriptorProto.Type The types GROUP and MESSAGE
     * are omitted, but the numerical values are identical.
     */
    var ScalarType$1;
    (function (ScalarType) {
        // 0 is reserved for errors.
        // Order is weird for historical reasons.
        ScalarType[ScalarType["DOUBLE"] = 1] = "DOUBLE";
        ScalarType[ScalarType["FLOAT"] = 2] = "FLOAT";
        // Not ZigZag encoded.  Negative numbers take 10 bytes.  Use TYPE_SINT64 if
        // negative values are likely.
        ScalarType[ScalarType["INT64"] = 3] = "INT64";
        ScalarType[ScalarType["UINT64"] = 4] = "UINT64";
        // Not ZigZag encoded.  Negative numbers take 10 bytes.  Use TYPE_SINT32 if
        // negative values are likely.
        ScalarType[ScalarType["INT32"] = 5] = "INT32";
        ScalarType[ScalarType["FIXED64"] = 6] = "FIXED64";
        ScalarType[ScalarType["FIXED32"] = 7] = "FIXED32";
        ScalarType[ScalarType["BOOL"] = 8] = "BOOL";
        ScalarType[ScalarType["STRING"] = 9] = "STRING";
        // Tag-delimited aggregate.
        // Group type is deprecated and not supported in proto3. However, Proto3
        // implementations should still be able to parse the group wire format and
        // treat group fields as unknown fields.
        // TYPE_GROUP = 10,
        // TYPE_MESSAGE = 11,  // Length-delimited aggregate.
        // New in version 2.
        ScalarType[ScalarType["BYTES"] = 12] = "BYTES";
        ScalarType[ScalarType["UINT32"] = 13] = "UINT32";
        // TYPE_ENUM = 14,
        ScalarType[ScalarType["SFIXED32"] = 15] = "SFIXED32";
        ScalarType[ScalarType["SFIXED64"] = 16] = "SFIXED64";
        ScalarType[ScalarType["SINT32"] = 17] = "SINT32";
        ScalarType[ScalarType["SINT64"] = 18] = "SINT64";
    })(ScalarType$1 || (ScalarType$1 = {}));
    /**
     * JavaScript representation of fields with 64 bit integral types (int64, uint64,
     * sint64, fixed64, sfixed64).
     *
     * This is a subset of google.protobuf.FieldOptions.JSType, which defines JS_NORMAL,
     * JS_STRING, and JS_NUMBER. Protobuf-ES uses BigInt by default, but will use
     * String if `[jstype = JS_STRING]` is specified.
     *
     * ```protobuf
     * uint64 field_a = 1; // BigInt
     * uint64 field_b = 2 [jstype = JS_NORMAL]; // BigInt
     * uint64 field_b = 2 [jstype = JS_NUMBER]; // BigInt
     * uint64 field_b = 2 [jstype = JS_STRING]; // String
     * ```
     */
    var LongType;
    (function (LongType) {
        /**
         * Use JavaScript BigInt.
         */
        LongType[LongType["BIGINT"] = 0] = "BIGINT";
        /**
         * Use JavaScript String.
         *
         * Field option `[jstype = JS_STRING]`.
         */
        LongType[LongType["STRING"] = 1] = "STRING";
    })(LongType || (LongType = {}));

    // Copyright 2021-2024 Buf Technologies, Inc.
    //
    // Licensed under the Apache License, Version 2.0 (the "License");
    // you may not use this file except in compliance with the License.
    // You may obtain a copy of the License at
    //
    //      http://www.apache.org/licenses/LICENSE-2.0
    //
    // Unless required by applicable law or agreed to in writing, software
    // distributed under the License is distributed on an "AS IS" BASIS,
    // WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
    // See the License for the specific language governing permissions and
    // limitations under the License.
    /**
     * Returns true if both scalar values are equal.
     */
    function scalarEquals(type, a, b) {
        if (a === b) {
            // This correctly matches equal values except BYTES and (possibly) 64-bit integers.
            return true;
        }
        // Special case BYTES - we need to compare each byte individually
        if (type == ScalarType$1.BYTES) {
            if (!(a instanceof Uint8Array) || !(b instanceof Uint8Array)) {
                return false;
            }
            if (a.length !== b.length) {
                return false;
            }
            for (let i = 0; i < a.length; i++) {
                if (a[i] !== b[i]) {
                    return false;
                }
            }
            return true;
        }
        // Special case 64-bit integers - we support number, string and bigint representation.
        // eslint-disable-next-line @typescript-eslint/switch-exhaustiveness-check
        switch (type) {
            case ScalarType$1.UINT64:
            case ScalarType$1.FIXED64:
            case ScalarType$1.INT64:
            case ScalarType$1.SFIXED64:
            case ScalarType$1.SINT64:
                // Loose comparison will match between 0n, 0 and "0".
                return a == b;
        }
        // Anything that hasn't been caught by strict comparison or special cased
        // BYTES and 64-bit integers is not equal.
        return false;
    }
    /**
     * Returns the zero value for the given scalar type.
     */
    function scalarZeroValue(type, longType) {
        switch (type) {
            case ScalarType$1.BOOL:
                return false;
            case ScalarType$1.UINT64:
            case ScalarType$1.FIXED64:
            case ScalarType$1.INT64:
            case ScalarType$1.SFIXED64:
            case ScalarType$1.SINT64:
                // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison -- acceptable since it's covered by tests
                return (longType == 0 ? protoInt64.zero : "0");
            case ScalarType$1.DOUBLE:
            case ScalarType$1.FLOAT:
                return 0.0;
            case ScalarType$1.BYTES:
                return new Uint8Array(0);
            case ScalarType$1.STRING:
                return "";
            default:
                // Handles INT32, UINT32, SINT32, FIXED32, SFIXED32.
                // We do not use individual cases to save a few bytes code size.
                return 0;
        }
    }
    /**
     * Returns true for a zero-value. For example, an integer has the zero-value `0`,
     * a boolean is `false`, a string is `""`, and bytes is an empty Uint8Array.
     *
     * In proto3, zero-values are not written to the wire, unless the field is
     * optional or repeated.
     */
    function isScalarZeroValue(type, value) {
        switch (type) {
            case ScalarType$1.BOOL:
                return value === false;
            case ScalarType$1.STRING:
                return value === "";
            case ScalarType$1.BYTES:
                return value instanceof Uint8Array && !value.byteLength;
            default:
                return value == 0; // Loose comparison matches 0n, 0 and "0"
        }
    }

    // Copyright 2021-2024 Buf Technologies, Inc.
    //
    // Licensed under the Apache License, Version 2.0 (the "License");
    // you may not use this file except in compliance with the License.
    // You may obtain a copy of the License at
    //
    //      http://www.apache.org/licenses/LICENSE-2.0
    //
    // Unless required by applicable law or agreed to in writing, software
    // distributed under the License is distributed on an "AS IS" BASIS,
    // WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
    // See the License for the specific language governing permissions and
    // limitations under the License.
    /* eslint-disable prefer-const,no-case-declarations,@typescript-eslint/restrict-plus-operands */
    /**
     * Protobuf binary format wire types.
     *
     * A wire type provides just enough information to find the length of the
     * following value.
     *
     * See https://developers.google.com/protocol-buffers/docs/encoding#structure
     */
    var WireType;
    (function (WireType) {
        /**
         * Used for int32, int64, uint32, uint64, sint32, sint64, bool, enum
         */
        WireType[WireType["Varint"] = 0] = "Varint";
        /**
         * Used for fixed64, sfixed64, double.
         * Always 8 bytes with little-endian byte order.
         */
        WireType[WireType["Bit64"] = 1] = "Bit64";
        /**
         * Used for string, bytes, embedded messages, packed repeated fields
         *
         * Only repeated numeric types (types which use the varint, 32-bit,
         * or 64-bit wire types) can be packed. In proto3, such fields are
         * packed by default.
         */
        WireType[WireType["LengthDelimited"] = 2] = "LengthDelimited";
        /**
         * Start of a tag-delimited aggregate, such as a proto2 group, or a message
         * in editions with message_encoding = DELIMITED.
         */
        WireType[WireType["StartGroup"] = 3] = "StartGroup";
        /**
         * End of a tag-delimited aggregate.
         */
        WireType[WireType["EndGroup"] = 4] = "EndGroup";
        /**
         * Used for fixed32, sfixed32, float.
         * Always 4 bytes with little-endian byte order.
         */
        WireType[WireType["Bit32"] = 5] = "Bit32";
    })(WireType || (WireType = {}));
    class BinaryWriter {
        constructor(textEncoder) {
            /**
             * Previous fork states.
             */
            this.stack = [];
            this.textEncoder = textEncoder !== null && textEncoder !== void 0 ? textEncoder : new TextEncoder();
            this.chunks = [];
            this.buf = [];
        }
        /**
         * Return all bytes written and reset this writer.
         */
        finish() {
            this.chunks.push(new Uint8Array(this.buf)); // flush the buffer
            let len = 0;
            for (let i = 0; i < this.chunks.length; i++)
                len += this.chunks[i].length;
            let bytes = new Uint8Array(len);
            let offset = 0;
            for (let i = 0; i < this.chunks.length; i++) {
                bytes.set(this.chunks[i], offset);
                offset += this.chunks[i].length;
            }
            this.chunks = [];
            return bytes;
        }
        /**
         * Start a new fork for length-delimited data like a message
         * or a packed repeated field.
         *
         * Must be joined later with `join()`.
         */
        fork() {
            this.stack.push({ chunks: this.chunks, buf: this.buf });
            this.chunks = [];
            this.buf = [];
            return this;
        }
        /**
         * Join the last fork. Write its length and bytes, then
         * return to the previous state.
         */
        join() {
            // get chunk of fork
            let chunk = this.finish();
            // restore previous state
            let prev = this.stack.pop();
            if (!prev)
                throw new Error("invalid state, fork stack empty");
            this.chunks = prev.chunks;
            this.buf = prev.buf;
            // write length of chunk as varint
            this.uint32(chunk.byteLength);
            return this.raw(chunk);
        }
        /**
         * Writes a tag (field number and wire type).
         *
         * Equivalent to `uint32( (fieldNo << 3 | type) >>> 0 )`.
         *
         * Generated code should compute the tag ahead of time and call `uint32()`.
         */
        tag(fieldNo, type) {
            return this.uint32(((fieldNo << 3) | type) >>> 0);
        }
        /**
         * Write a chunk of raw bytes.
         */
        raw(chunk) {
            if (this.buf.length) {
                this.chunks.push(new Uint8Array(this.buf));
                this.buf = [];
            }
            this.chunks.push(chunk);
            return this;
        }
        /**
         * Write a `uint32` value, an unsigned 32 bit varint.
         */
        uint32(value) {
            assertUInt32(value);
            // write value as varint 32, inlined for speed
            while (value > 0x7f) {
                this.buf.push((value & 0x7f) | 0x80);
                value = value >>> 7;
            }
            this.buf.push(value);
            return this;
        }
        /**
         * Write a `int32` value, a signed 32 bit varint.
         */
        int32(value) {
            assertInt32(value);
            varint32write(value, this.buf);
            return this;
        }
        /**
         * Write a `bool` value, a variant.
         */
        bool(value) {
            this.buf.push(value ? 1 : 0);
            return this;
        }
        /**
         * Write a `bytes` value, length-delimited arbitrary data.
         */
        bytes(value) {
            this.uint32(value.byteLength); // write length of chunk as varint
            return this.raw(value);
        }
        /**
         * Write a `string` value, length-delimited data converted to UTF-8 text.
         */
        string(value) {
            let chunk = this.textEncoder.encode(value);
            this.uint32(chunk.byteLength); // write length of chunk as varint
            return this.raw(chunk);
        }
        /**
         * Write a `float` value, 32-bit floating point number.
         */
        float(value) {
            assertFloat32(value);
            let chunk = new Uint8Array(4);
            new DataView(chunk.buffer).setFloat32(0, value, true);
            return this.raw(chunk);
        }
        /**
         * Write a `double` value, a 64-bit floating point number.
         */
        double(value) {
            let chunk = new Uint8Array(8);
            new DataView(chunk.buffer).setFloat64(0, value, true);
            return this.raw(chunk);
        }
        /**
         * Write a `fixed32` value, an unsigned, fixed-length 32-bit integer.
         */
        fixed32(value) {
            assertUInt32(value);
            let chunk = new Uint8Array(4);
            new DataView(chunk.buffer).setUint32(0, value, true);
            return this.raw(chunk);
        }
        /**
         * Write a `sfixed32` value, a signed, fixed-length 32-bit integer.
         */
        sfixed32(value) {
            assertInt32(value);
            let chunk = new Uint8Array(4);
            new DataView(chunk.buffer).setInt32(0, value, true);
            return this.raw(chunk);
        }
        /**
         * Write a `sint32` value, a signed, zigzag-encoded 32-bit varint.
         */
        sint32(value) {
            assertInt32(value);
            // zigzag encode
            value = ((value << 1) ^ (value >> 31)) >>> 0;
            varint32write(value, this.buf);
            return this;
        }
        /**
         * Write a `fixed64` value, a signed, fixed-length 64-bit integer.
         */
        sfixed64(value) {
            let chunk = new Uint8Array(8), view = new DataView(chunk.buffer), tc = protoInt64.enc(value);
            view.setInt32(0, tc.lo, true);
            view.setInt32(4, tc.hi, true);
            return this.raw(chunk);
        }
        /**
         * Write a `fixed64` value, an unsigned, fixed-length 64 bit integer.
         */
        fixed64(value) {
            let chunk = new Uint8Array(8), view = new DataView(chunk.buffer), tc = protoInt64.uEnc(value);
            view.setInt32(0, tc.lo, true);
            view.setInt32(4, tc.hi, true);
            return this.raw(chunk);
        }
        /**
         * Write a `int64` value, a signed 64-bit varint.
         */
        int64(value) {
            let tc = protoInt64.enc(value);
            varint64write(tc.lo, tc.hi, this.buf);
            return this;
        }
        /**
         * Write a `sint64` value, a signed, zig-zag-encoded 64-bit varint.
         */
        sint64(value) {
            let tc = protoInt64.enc(value), 
            // zigzag encode
            sign = tc.hi >> 31, lo = (tc.lo << 1) ^ sign, hi = ((tc.hi << 1) | (tc.lo >>> 31)) ^ sign;
            varint64write(lo, hi, this.buf);
            return this;
        }
        /**
         * Write a `uint64` value, an unsigned 64-bit varint.
         */
        uint64(value) {
            let tc = protoInt64.uEnc(value);
            varint64write(tc.lo, tc.hi, this.buf);
            return this;
        }
    }
    class BinaryReader {
        constructor(buf, textDecoder) {
            this.varint64 = varint64read; // dirty cast for `this`
            /**
             * Read a `uint32` field, an unsigned 32 bit varint.
             */
            this.uint32 = varint32read; // dirty cast for `this` and access to protected `buf`
            this.buf = buf;
            this.len = buf.length;
            this.pos = 0;
            this.view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
            this.textDecoder = textDecoder !== null && textDecoder !== void 0 ? textDecoder : new TextDecoder();
        }
        /**
         * Reads a tag - field number and wire type.
         */
        tag() {
            let tag = this.uint32(), fieldNo = tag >>> 3, wireType = tag & 7;
            if (fieldNo <= 0 || wireType < 0 || wireType > 5)
                throw new Error("illegal tag: field no " + fieldNo + " wire type " + wireType);
            return [fieldNo, wireType];
        }
        /**
         * Skip one element and return the skipped data.
         *
         * When skipping StartGroup, provide the tags field number to check for
         * matching field number in the EndGroup tag.
         */
        skip(wireType, fieldNo) {
            let start = this.pos;
            switch (wireType) {
                case WireType.Varint:
                    while (this.buf[this.pos++] & 0x80) {
                        // ignore
                    }
                    break;
                // eslint-disable-next-line
                // @ts-ignore TS7029: Fallthrough case in switch
                case WireType.Bit64:
                    this.pos += 4;
                // eslint-disable-next-line
                // @ts-ignore TS7029: Fallthrough case in switch
                case WireType.Bit32:
                    this.pos += 4;
                    break;
                case WireType.LengthDelimited:
                    let len = this.uint32();
                    this.pos += len;
                    break;
                case WireType.StartGroup:
                    for (;;) {
                        const [fn, wt] = this.tag();
                        if (wt === WireType.EndGroup) {
                            if (fieldNo !== undefined && fn !== fieldNo) {
                                throw new Error("invalid end group tag");
                            }
                            break;
                        }
                        this.skip(wt, fn);
                    }
                    break;
                default:
                    throw new Error("cant skip wire type " + wireType);
            }
            this.assertBounds();
            return this.buf.subarray(start, this.pos);
        }
        /**
         * Throws error if position in byte array is out of range.
         */
        assertBounds() {
            if (this.pos > this.len)
                throw new RangeError("premature EOF");
        }
        /**
         * Read a `int32` field, a signed 32 bit varint.
         */
        int32() {
            return this.uint32() | 0;
        }
        /**
         * Read a `sint32` field, a signed, zigzag-encoded 32-bit varint.
         */
        sint32() {
            let zze = this.uint32();
            // decode zigzag
            return (zze >>> 1) ^ -(zze & 1);
        }
        /**
         * Read a `int64` field, a signed 64-bit varint.
         */
        int64() {
            return protoInt64.dec(...this.varint64());
        }
        /**
         * Read a `uint64` field, an unsigned 64-bit varint.
         */
        uint64() {
            return protoInt64.uDec(...this.varint64());
        }
        /**
         * Read a `sint64` field, a signed, zig-zag-encoded 64-bit varint.
         */
        sint64() {
            let [lo, hi] = this.varint64();
            // decode zig zag
            let s = -(lo & 1);
            lo = ((lo >>> 1) | ((hi & 1) << 31)) ^ s;
            hi = (hi >>> 1) ^ s;
            return protoInt64.dec(lo, hi);
        }
        /**
         * Read a `bool` field, a variant.
         */
        bool() {
            let [lo, hi] = this.varint64();
            return lo !== 0 || hi !== 0;
        }
        /**
         * Read a `fixed32` field, an unsigned, fixed-length 32-bit integer.
         */
        fixed32() {
            return this.view.getUint32((this.pos += 4) - 4, true);
        }
        /**
         * Read a `sfixed32` field, a signed, fixed-length 32-bit integer.
         */
        sfixed32() {
            return this.view.getInt32((this.pos += 4) - 4, true);
        }
        /**
         * Read a `fixed64` field, an unsigned, fixed-length 64 bit integer.
         */
        fixed64() {
            return protoInt64.uDec(this.sfixed32(), this.sfixed32());
        }
        /**
         * Read a `fixed64` field, a signed, fixed-length 64-bit integer.
         */
        sfixed64() {
            return protoInt64.dec(this.sfixed32(), this.sfixed32());
        }
        /**
         * Read a `float` field, 32-bit floating point number.
         */
        float() {
            return this.view.getFloat32((this.pos += 4) - 4, true);
        }
        /**
         * Read a `double` field, a 64-bit floating point number.
         */
        double() {
            return this.view.getFloat64((this.pos += 8) - 8, true);
        }
        /**
         * Read a `bytes` field, length-delimited arbitrary data.
         */
        bytes() {
            let len = this.uint32(), start = this.pos;
            this.pos += len;
            this.assertBounds();
            return this.buf.subarray(start, start + len);
        }
        /**
         * Read a `string` field, length-delimited data converted to UTF-8 text.
         */
        string() {
            return this.textDecoder.decode(this.bytes());
        }
    }

    // Copyright 2021-2024 Buf Technologies, Inc.
    //
    // Licensed under the Apache License, Version 2.0 (the "License");
    // you may not use this file except in compliance with the License.
    // You may obtain a copy of the License at
    //
    //      http://www.apache.org/licenses/LICENSE-2.0
    //
    // Unless required by applicable law or agreed to in writing, software
    // distributed under the License is distributed on an "AS IS" BASIS,
    // WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
    // See the License for the specific language governing permissions and
    // limitations under the License.
    /**
     * Create a new extension using the given runtime.
     */
    function makeExtension(runtime, typeName, extendee, field) {
        let fi;
        return {
            typeName,
            extendee,
            get field() {
                if (!fi) {
                    const i = (typeof field == "function" ? field() : field);
                    i.name = typeName.split(".").pop();
                    i.jsonName = `[${typeName}]`;
                    fi = runtime.util.newFieldList([i]).list()[0];
                }
                return fi;
            },
            runtime,
        };
    }
    /**
     * Create a container that allows us to read extension fields into it with the
     * same logic as regular fields.
     */
    function createExtensionContainer(extension) {
        const localName = extension.field.localName;
        const container = Object.create(null);
        container[localName] = initExtensionField(extension);
        return [container, () => container[localName]];
    }
    function initExtensionField(ext) {
        const field = ext.field;
        if (field.repeated) {
            return [];
        }
        if (field.default !== undefined) {
            return field.default;
        }
        switch (field.kind) {
            case "enum":
                return field.T.values[0].no;
            case "scalar":
                return scalarZeroValue(field.T, field.L);
            case "message":
                // eslint-disable-next-line no-case-declarations
                const T = field.T, value = new T();
                return T.fieldWrapper ? T.fieldWrapper.unwrapField(value) : value;
            case "map":
                throw "map fields are not allowed to be extensions";
        }
    }
    /**
     * Helper to filter unknown fields, optimized based on field type.
     */
    function filterUnknownFields(unknownFields, field) {
        if (!field.repeated && (field.kind == "enum" || field.kind == "scalar")) {
            // singular scalar fields do not merge, we pick the last
            for (let i = unknownFields.length - 1; i >= 0; --i) {
                if (unknownFields[i].no == field.no) {
                    return [unknownFields[i]];
                }
            }
            return [];
        }
        return unknownFields.filter((uf) => uf.no === field.no);
    }

    // Copyright 2021-2024 Buf Technologies, Inc.
    //
    // Licensed under the Apache License, Version 2.0 (the "License");
    // you may not use this file except in compliance with the License.
    // You may obtain a copy of the License at
    //
    //      http://www.apache.org/licenses/LICENSE-2.0
    //
    // Unless required by applicable law or agreed to in writing, software
    // distributed under the License is distributed on an "AS IS" BASIS,
    // WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
    // See the License for the specific language governing permissions and
    // limitations under the License.
    /* eslint-disable @typescript-eslint/ban-ts-comment, @typescript-eslint/no-unnecessary-condition, prefer-const */
    // lookup table from base64 character to byte
    let encTable = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/".split("");
    // lookup table from base64 character *code* to byte because lookup by number is fast
    let decTable = [];
    for (let i = 0; i < encTable.length; i++)
        decTable[encTable[i].charCodeAt(0)] = i;
    // support base64url variants
    decTable["-".charCodeAt(0)] = encTable.indexOf("+");
    decTable["_".charCodeAt(0)] = encTable.indexOf("/");
    const protoBase64 = {
        /**
         * Decodes a base64 string to a byte array.
         *
         * - ignores white-space, including line breaks and tabs
         * - allows inner padding (can decode concatenated base64 strings)
         * - does not require padding
         * - understands base64url encoding:
         *   "-" instead of "+",
         *   "_" instead of "/",
         *   no padding
         */
        dec(base64Str) {
            // estimate byte size, not accounting for inner padding and whitespace
            let es = (base64Str.length * 3) / 4;
            if (base64Str[base64Str.length - 2] == "=")
                es -= 2;
            else if (base64Str[base64Str.length - 1] == "=")
                es -= 1;
            let bytes = new Uint8Array(es), bytePos = 0, // position in byte array
            groupPos = 0, // position in base64 group
            b, // current byte
            p = 0; // previous byte
            for (let i = 0; i < base64Str.length; i++) {
                b = decTable[base64Str.charCodeAt(i)];
                if (b === undefined) {
                    switch (base64Str[i]) {
                        // @ts-ignore TS7029: Fallthrough case in switch
                        case "=":
                            groupPos = 0; // reset state when padding found
                        // @ts-ignore TS7029: Fallthrough case in switch
                        case "\n":
                        case "\r":
                        case "\t":
                        case " ":
                            continue; // skip white-space, and padding
                        default:
                            throw Error("invalid base64 string.");
                    }
                }
                switch (groupPos) {
                    case 0:
                        p = b;
                        groupPos = 1;
                        break;
                    case 1:
                        bytes[bytePos++] = (p << 2) | ((b & 48) >> 4);
                        p = b;
                        groupPos = 2;
                        break;
                    case 2:
                        bytes[bytePos++] = ((p & 15) << 4) | ((b & 60) >> 2);
                        p = b;
                        groupPos = 3;
                        break;
                    case 3:
                        bytes[bytePos++] = ((p & 3) << 6) | b;
                        groupPos = 0;
                        break;
                }
            }
            if (groupPos == 1)
                throw Error("invalid base64 string.");
            return bytes.subarray(0, bytePos);
        },
        /**
         * Encode a byte array to a base64 string.
         */
        enc(bytes) {
            let base64 = "", groupPos = 0, // position in base64 group
            b, // current byte
            p = 0; // carry over from previous byte
            for (let i = 0; i < bytes.length; i++) {
                b = bytes[i];
                switch (groupPos) {
                    case 0:
                        base64 += encTable[b >> 2];
                        p = (b & 3) << 4;
                        groupPos = 1;
                        break;
                    case 1:
                        base64 += encTable[p | (b >> 4)];
                        p = (b & 15) << 2;
                        groupPos = 2;
                        break;
                    case 2:
                        base64 += encTable[p | (b >> 6)];
                        base64 += encTable[b & 63];
                        groupPos = 0;
                        break;
                }
            }
            // add output padding
            if (groupPos) {
                base64 += encTable[p];
                base64 += "=";
                if (groupPos == 1)
                    base64 += "=";
            }
            return base64;
        },
    };

    // Copyright 2021-2024 Buf Technologies, Inc.
    //
    // Licensed under the Apache License, Version 2.0 (the "License");
    // you may not use this file except in compliance with the License.
    // You may obtain a copy of the License at
    //
    //      http://www.apache.org/licenses/LICENSE-2.0
    //
    // Unless required by applicable law or agreed to in writing, software
    // distributed under the License is distributed on an "AS IS" BASIS,
    // WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
    // See the License for the specific language governing permissions and
    // limitations under the License.
    /**
     * Retrieve an extension value from a message.
     *
     * The function never returns undefined. Use hasExtension() to check whether an
     * extension is set. If the extension is not set, this function returns the
     * default value (if one was specified in the protobuf source), or the zero value
     * (for example `0` for numeric types, `[]` for repeated extension fields, and
     * an empty message instance for message fields).
     *
     * Extensions are stored as unknown fields on a message. To mutate an extension
     * value, make sure to store the new value with setExtension() after mutating.
     *
     * If the extension does not extend the given message, an error is raised.
     */
    function getExtension(message, extension, options) {
        assertExtendee(extension, message);
        const opt = extension.runtime.bin.makeReadOptions(options);
        const ufs = filterUnknownFields(message.getType().runtime.bin.listUnknownFields(message), extension.field);
        const [container, get] = createExtensionContainer(extension);
        for (const uf of ufs) {
            extension.runtime.bin.readField(container, opt.readerFactory(uf.data), extension.field, uf.wireType, opt);
        }
        return get();
    }
    /**
     * Set an extension value on a message. If the message already has a value for
     * this extension, the value is replaced.
     *
     * If the extension does not extend the given message, an error is raised.
     */
    function setExtension(message, extension, value, options) {
        assertExtendee(extension, message);
        const readOpt = extension.runtime.bin.makeReadOptions(options);
        const writeOpt = extension.runtime.bin.makeWriteOptions(options);
        if (hasExtension(message, extension)) {
            const ufs = message
                .getType()
                .runtime.bin.listUnknownFields(message)
                .filter((uf) => uf.no != extension.field.no);
            message.getType().runtime.bin.discardUnknownFields(message);
            for (const uf of ufs) {
                message
                    .getType()
                    .runtime.bin.onUnknownField(message, uf.no, uf.wireType, uf.data);
            }
        }
        const writer = writeOpt.writerFactory();
        let f = extension.field;
        // Implicit presence does not apply to extensions, see https://github.com/protocolbuffers/protobuf/issues/8234
        // We patch the field info to use explicit presence:
        if (!f.opt && !f.repeated && (f.kind == "enum" || f.kind == "scalar")) {
            f = Object.assign(Object.assign({}, extension.field), { opt: true });
        }
        extension.runtime.bin.writeField(f, value, writer, writeOpt);
        const reader = readOpt.readerFactory(writer.finish());
        while (reader.pos < reader.len) {
            const [no, wireType] = reader.tag();
            const data = reader.skip(wireType, no);
            message.getType().runtime.bin.onUnknownField(message, no, wireType, data);
        }
    }
    /**
     * Check whether an extension is set on a message.
     */
    function hasExtension(message, extension) {
        const messageType = message.getType();
        return (extension.extendee.typeName === messageType.typeName &&
            !!messageType.runtime.bin
                .listUnknownFields(message)
                .find((uf) => uf.no == extension.field.no));
    }
    function assertExtendee(extension, message) {
        assert(extension.extendee.typeName == message.getType().typeName, `extension ${extension.typeName} can only be applied to message ${extension.extendee.typeName}`);
    }

    // Copyright 2021-2024 Buf Technologies, Inc.
    //
    // Licensed under the Apache License, Version 2.0 (the "License");
    // you may not use this file except in compliance with the License.
    // You may obtain a copy of the License at
    //
    //      http://www.apache.org/licenses/LICENSE-2.0
    //
    // Unless required by applicable law or agreed to in writing, software
    // distributed under the License is distributed on an "AS IS" BASIS,
    // WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
    // See the License for the specific language governing permissions and
    // limitations under the License.
    /**
     * Returns true if the field is set.
     */
    function isFieldSet(field, target) {
        const localName = field.localName;
        if (field.repeated) {
            return target[localName].length > 0;
        }
        if (field.oneof) {
            return target[field.oneof.localName].case === localName; // eslint-disable-line @typescript-eslint/no-unsafe-member-access
        }
        switch (field.kind) {
            case "enum":
            case "scalar":
                if (field.opt || field.req) {
                    // explicit presence
                    return target[localName] !== undefined;
                }
                // implicit presence
                if (field.kind == "enum") {
                    return target[localName] !== field.T.values[0].no;
                }
                return !isScalarZeroValue(field.T, target[localName]);
            case "message":
                return target[localName] !== undefined;
            case "map":
                return Object.keys(target[localName]).length > 0; // eslint-disable-line @typescript-eslint/no-unsafe-argument
        }
    }
    /**
     * Resets the field, so that isFieldSet() will return false.
     */
    function clearField(field, target) {
        const localName = field.localName;
        const implicitPresence = !field.opt && !field.req;
        if (field.repeated) {
            target[localName] = [];
        }
        else if (field.oneof) {
            target[field.oneof.localName] = { case: undefined };
        }
        else {
            switch (field.kind) {
                case "map":
                    target[localName] = {};
                    break;
                case "enum":
                    target[localName] = implicitPresence ? field.T.values[0].no : undefined;
                    break;
                case "scalar":
                    target[localName] = implicitPresence
                        ? scalarZeroValue(field.T, field.L)
                        : undefined;
                    break;
                case "message":
                    target[localName] = undefined;
                    break;
            }
        }
    }

    // Copyright 2021-2024 Buf Technologies, Inc.
    //
    // Licensed under the Apache License, Version 2.0 (the "License");
    // you may not use this file except in compliance with the License.
    // You may obtain a copy of the License at
    //
    //      http://www.apache.org/licenses/LICENSE-2.0
    //
    // Unless required by applicable law or agreed to in writing, software
    // distributed under the License is distributed on an "AS IS" BASIS,
    // WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
    // See the License for the specific language governing permissions and
    // limitations under the License.
    /**
     * Check whether the given object is any subtype of Message or is a specific
     * Message by passing the type.
     *
     * Just like `instanceof`, `isMessage` narrows the type. The advantage of
     * `isMessage` is that it compares identity by the message type name, not by
     * class identity. This makes it robust against the dual package hazard and
     * similar situations, where the same message is duplicated.
     *
     * This function is _mostly_ equivalent to the `instanceof` operator. For
     * example, `isMessage(foo, MyMessage)` is the same as `foo instanceof MyMessage`,
     * and `isMessage(foo)` is the same as `foo instanceof Message`. In most cases,
     * `isMessage` should be preferred over `instanceof`.
     *
     * However, due to the fact that `isMessage` does not use class identity, there
     * are subtle differences between this function and `instanceof`. Notably,
     * calling `isMessage` on an explicit type of Message will return false.
     */
    function isMessage(arg, type) {
        if (arg === null || typeof arg != "object") {
            return false;
        }
        if (!Object.getOwnPropertyNames(Message.prototype).every((m) => m in arg && typeof arg[m] == "function")) {
            return false;
        }
        const actualType = arg.getType();
        if (actualType === null ||
            typeof actualType != "function" ||
            !("typeName" in actualType) ||
            typeof actualType.typeName != "string") {
            return false;
        }
        return type === undefined ? true : actualType.typeName == type.typeName;
    }

    // Copyright 2021-2024 Buf Technologies, Inc.
    //
    // Licensed under the Apache License, Version 2.0 (the "License");
    // you may not use this file except in compliance with the License.
    // You may obtain a copy of the License at
    //
    //      http://www.apache.org/licenses/LICENSE-2.0
    //
    // Unless required by applicable law or agreed to in writing, software
    // distributed under the License is distributed on an "AS IS" BASIS,
    // WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
    // See the License for the specific language governing permissions and
    // limitations under the License.
    /**
     * Wrap a primitive message field value in its corresponding wrapper
     * message. This function is idempotent.
     */
    function wrapField(type, value) {
        if (isMessage(value) || !type.fieldWrapper) {
            return value;
        }
        return type.fieldWrapper.wrapField(value);
    }
    ({
        "google.protobuf.DoubleValue": ScalarType$1.DOUBLE,
        "google.protobuf.FloatValue": ScalarType$1.FLOAT,
        "google.protobuf.Int64Value": ScalarType$1.INT64,
        "google.protobuf.UInt64Value": ScalarType$1.UINT64,
        "google.protobuf.Int32Value": ScalarType$1.INT32,
        "google.protobuf.UInt32Value": ScalarType$1.UINT32,
        "google.protobuf.BoolValue": ScalarType$1.BOOL,
        "google.protobuf.StringValue": ScalarType$1.STRING,
        "google.protobuf.BytesValue": ScalarType$1.BYTES,
    });

    // Copyright 2021-2024 Buf Technologies, Inc.
    //
    // Licensed under the Apache License, Version 2.0 (the "License");
    // you may not use this file except in compliance with the License.
    // You may obtain a copy of the License at
    //
    //      http://www.apache.org/licenses/LICENSE-2.0
    //
    // Unless required by applicable law or agreed to in writing, software
    // distributed under the License is distributed on an "AS IS" BASIS,
    // WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
    // See the License for the specific language governing permissions and
    // limitations under the License.
    /* eslint-disable no-case-declarations,@typescript-eslint/no-unsafe-argument,@typescript-eslint/no-unsafe-assignment,@typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-call */
    // Default options for parsing JSON.
    const jsonReadDefaults = {
        ignoreUnknownFields: false,
    };
    // Default options for serializing to JSON.
    const jsonWriteDefaults = {
        emitDefaultValues: false,
        enumAsInteger: false,
        useProtoFieldName: false,
        prettySpaces: 0,
    };
    function makeReadOptions$1(options) {
        return options ? Object.assign(Object.assign({}, jsonReadDefaults), options) : jsonReadDefaults;
    }
    function makeWriteOptions$1(options) {
        return options ? Object.assign(Object.assign({}, jsonWriteDefaults), options) : jsonWriteDefaults;
    }
    const tokenNull = Symbol();
    const tokenIgnoredUnknownEnum = Symbol();
    function makeJsonFormat() {
        return {
            makeReadOptions: makeReadOptions$1,
            makeWriteOptions: makeWriteOptions$1,
            readMessage(type, json, options, message) {
                if (json == null || Array.isArray(json) || typeof json != "object") {
                    throw new Error(`cannot decode message ${type.typeName} from JSON: ${debugJsonValue(json)}`);
                }
                message = message !== null && message !== void 0 ? message : new type();
                const oneofSeen = new Map();
                const registry = options.typeRegistry;
                for (const [jsonKey, jsonValue] of Object.entries(json)) {
                    const field = type.fields.findJsonName(jsonKey);
                    if (field) {
                        if (field.oneof) {
                            if (jsonValue === null && field.kind == "scalar") {
                                // see conformance test Required.Proto3.JsonInput.OneofFieldNull{First,Second}
                                continue;
                            }
                            const seen = oneofSeen.get(field.oneof);
                            if (seen !== undefined) {
                                throw new Error(`cannot decode message ${type.typeName} from JSON: multiple keys for oneof "${field.oneof.name}" present: "${seen}", "${jsonKey}"`);
                            }
                            oneofSeen.set(field.oneof, jsonKey);
                        }
                        readField$1(message, jsonValue, field, options, type);
                    }
                    else {
                        let found = false;
                        if ((registry === null || registry === void 0 ? void 0 : registry.findExtension) &&
                            jsonKey.startsWith("[") &&
                            jsonKey.endsWith("]")) {
                            const ext = registry.findExtension(jsonKey.substring(1, jsonKey.length - 1));
                            if (ext && ext.extendee.typeName == type.typeName) {
                                found = true;
                                const [container, get] = createExtensionContainer(ext);
                                readField$1(container, jsonValue, ext.field, options, ext);
                                // We pass on the options as BinaryReadOptions/BinaryWriteOptions,
                                // so that users can bring their own binary reader and writer factories
                                // if necessary.
                                setExtension(message, ext, get(), options);
                            }
                        }
                        if (!found && !options.ignoreUnknownFields) {
                            throw new Error(`cannot decode message ${type.typeName} from JSON: key "${jsonKey}" is unknown`);
                        }
                    }
                }
                return message;
            },
            writeMessage(message, options) {
                const type = message.getType();
                const json = {};
                let field;
                try {
                    for (field of type.fields.byNumber()) {
                        if (!isFieldSet(field, message)) {
                            // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
                            if (field.req) {
                                throw `required field not set`;
                            }
                            if (!options.emitDefaultValues) {
                                continue;
                            }
                            if (!canEmitFieldDefaultValue(field)) {
                                continue;
                            }
                        }
                        const value = field.oneof
                            ? message[field.oneof.localName].value
                            : message[field.localName];
                        const jsonValue = writeField$1(field, value, options);
                        if (jsonValue !== undefined) {
                            json[options.useProtoFieldName ? field.name : field.jsonName] =
                                jsonValue;
                        }
                    }
                    const registry = options.typeRegistry;
                    if (registry === null || registry === void 0 ? void 0 : registry.findExtensionFor) {
                        for (const uf of type.runtime.bin.listUnknownFields(message)) {
                            const ext = registry.findExtensionFor(type.typeName, uf.no);
                            if (ext && hasExtension(message, ext)) {
                                // We pass on the options as BinaryReadOptions, so that users can bring their own
                                // binary reader factory if necessary.
                                const value = getExtension(message, ext, options);
                                const jsonValue = writeField$1(ext.field, value, options);
                                if (jsonValue !== undefined) {
                                    json[ext.field.jsonName] = jsonValue;
                                }
                            }
                        }
                    }
                }
                catch (e) {
                    const m = field
                        ? `cannot encode field ${type.typeName}.${field.name} to JSON`
                        : `cannot encode message ${type.typeName} to JSON`;
                    const r = e instanceof Error ? e.message : String(e);
                    throw new Error(m + (r.length > 0 ? `: ${r}` : ""));
                }
                return json;
            },
            readScalar(type, json, longType) {
                // The signature of our internal function has changed. For backwards-
                // compatibility, we support the old form that is part of the public API
                // through the interface JsonFormat.
                return readScalar$1(type, json, longType !== null && longType !== void 0 ? longType : LongType.BIGINT, true);
            },
            writeScalar(type, value, emitDefaultValues) {
                // The signature of our internal function has changed. For backwards-
                // compatibility, we support the old form that is part of the public API
                // through the interface JsonFormat.
                if (value === undefined) {
                    return undefined;
                }
                if (emitDefaultValues || isScalarZeroValue(type, value)) {
                    return writeScalar$1(type, value);
                }
                return undefined;
            },
            debug: debugJsonValue,
        };
    }
    function debugJsonValue(json) {
        if (json === null) {
            return "null";
        }
        switch (typeof json) {
            case "object":
                return Array.isArray(json) ? "array" : "object";
            case "string":
                return json.length > 100 ? "string" : `"${json.split('"').join('\\"')}"`;
            default:
                return String(json);
        }
    }
    // Read a JSON value for a field.
    // The "parentType" argument is only used to provide context in errors.
    function readField$1(target, jsonValue, field, options, parentType) {
        let localName = field.localName;
        if (field.repeated) {
            assert(field.kind != "map");
            if (jsonValue === null) {
                return;
            }
            if (!Array.isArray(jsonValue)) {
                throw new Error(`cannot decode field ${parentType.typeName}.${field.name} from JSON: ${debugJsonValue(jsonValue)}`);
            }
            const targetArray = target[localName];
            for (const jsonItem of jsonValue) {
                if (jsonItem === null) {
                    throw new Error(`cannot decode field ${parentType.typeName}.${field.name} from JSON: ${debugJsonValue(jsonItem)}`);
                }
                switch (field.kind) {
                    case "message":
                        targetArray.push(field.T.fromJson(jsonItem, options));
                        break;
                    case "enum":
                        const enumValue = readEnum(field.T, jsonItem, options.ignoreUnknownFields, true);
                        if (enumValue !== tokenIgnoredUnknownEnum) {
                            targetArray.push(enumValue);
                        }
                        break;
                    case "scalar":
                        try {
                            targetArray.push(readScalar$1(field.T, jsonItem, field.L, true));
                        }
                        catch (e) {
                            let m = `cannot decode field ${parentType.typeName}.${field.name} from JSON: ${debugJsonValue(jsonItem)}`;
                            if (e instanceof Error && e.message.length > 0) {
                                m += `: ${e.message}`;
                            }
                            throw new Error(m);
                        }
                        break;
                }
            }
        }
        else if (field.kind == "map") {
            if (jsonValue === null) {
                return;
            }
            if (typeof jsonValue != "object" || Array.isArray(jsonValue)) {
                throw new Error(`cannot decode field ${parentType.typeName}.${field.name} from JSON: ${debugJsonValue(jsonValue)}`);
            }
            const targetMap = target[localName];
            for (const [jsonMapKey, jsonMapValue] of Object.entries(jsonValue)) {
                if (jsonMapValue === null) {
                    throw new Error(`cannot decode field ${parentType.typeName}.${field.name} from JSON: map value null`);
                }
                let key;
                try {
                    key = readMapKey(field.K, jsonMapKey);
                }
                catch (e) {
                    let m = `cannot decode map key for field ${parentType.typeName}.${field.name} from JSON: ${debugJsonValue(jsonValue)}`;
                    if (e instanceof Error && e.message.length > 0) {
                        m += `: ${e.message}`;
                    }
                    throw new Error(m);
                }
                switch (field.V.kind) {
                    case "message":
                        targetMap[key] = field.V.T.fromJson(jsonMapValue, options);
                        break;
                    case "enum":
                        const enumValue = readEnum(field.V.T, jsonMapValue, options.ignoreUnknownFields, true);
                        if (enumValue !== tokenIgnoredUnknownEnum) {
                            targetMap[key] = enumValue;
                        }
                        break;
                    case "scalar":
                        try {
                            targetMap[key] = readScalar$1(field.V.T, jsonMapValue, LongType.BIGINT, true);
                        }
                        catch (e) {
                            let m = `cannot decode map value for field ${parentType.typeName}.${field.name} from JSON: ${debugJsonValue(jsonValue)}`;
                            if (e instanceof Error && e.message.length > 0) {
                                m += `: ${e.message}`;
                            }
                            throw new Error(m);
                        }
                        break;
                }
            }
        }
        else {
            if (field.oneof) {
                target = target[field.oneof.localName] = { case: localName };
                localName = "value";
            }
            switch (field.kind) {
                case "message":
                    const messageType = field.T;
                    if (jsonValue === null &&
                        messageType.typeName != "google.protobuf.Value") {
                        return;
                    }
                    let currentValue = target[localName];
                    if (isMessage(currentValue)) {
                        currentValue.fromJson(jsonValue, options);
                    }
                    else {
                        target[localName] = currentValue = messageType.fromJson(jsonValue, options);
                        if (messageType.fieldWrapper && !field.oneof) {
                            target[localName] =
                                messageType.fieldWrapper.unwrapField(currentValue);
                        }
                    }
                    break;
                case "enum":
                    const enumValue = readEnum(field.T, jsonValue, options.ignoreUnknownFields, false);
                    switch (enumValue) {
                        case tokenNull:
                            clearField(field, target);
                            break;
                        case tokenIgnoredUnknownEnum:
                            break;
                        default:
                            target[localName] = enumValue;
                            break;
                    }
                    break;
                case "scalar":
                    try {
                        const scalarValue = readScalar$1(field.T, jsonValue, field.L, false);
                        switch (scalarValue) {
                            case tokenNull:
                                clearField(field, target);
                                break;
                            default:
                                target[localName] = scalarValue;
                                break;
                        }
                    }
                    catch (e) {
                        let m = `cannot decode field ${parentType.typeName}.${field.name} from JSON: ${debugJsonValue(jsonValue)}`;
                        if (e instanceof Error && e.message.length > 0) {
                            m += `: ${e.message}`;
                        }
                        throw new Error(m);
                    }
                    break;
            }
        }
    }
    function readMapKey(type, json) {
        if (type === ScalarType$1.BOOL) {
            // eslint-disable-next-line @typescript-eslint/switch-exhaustiveness-check
            switch (json) {
                case "true":
                    json = true;
                    break;
                case "false":
                    json = false;
                    break;
            }
        }
        return readScalar$1(type, json, LongType.BIGINT, true).toString();
    }
    function readScalar$1(type, json, longType, nullAsZeroValue) {
        if (json === null) {
            if (nullAsZeroValue) {
                return scalarZeroValue(type, longType);
            }
            return tokenNull;
        }
        // every valid case in the switch below returns, and every fall
        // through is regarded as a failure.
        switch (type) {
            // float, double: JSON value will be a number or one of the special string values "NaN", "Infinity", and "-Infinity".
            // Either numbers or strings are accepted. Exponent notation is also accepted.
            case ScalarType$1.DOUBLE:
            case ScalarType$1.FLOAT:
                if (json === "NaN")
                    return Number.NaN;
                if (json === "Infinity")
                    return Number.POSITIVE_INFINITY;
                if (json === "-Infinity")
                    return Number.NEGATIVE_INFINITY;
                if (json === "") {
                    // empty string is not a number
                    break;
                }
                if (typeof json == "string" && json.trim().length !== json.length) {
                    // extra whitespace
                    break;
                }
                if (typeof json != "string" && typeof json != "number") {
                    break;
                }
                const float = Number(json);
                if (Number.isNaN(float)) {
                    // not a number
                    break;
                }
                if (!Number.isFinite(float)) {
                    // infinity and -infinity are handled by string representation above, so this is an error
                    break;
                }
                if (type == ScalarType$1.FLOAT)
                    assertFloat32(float);
                return float;
            // int32, fixed32, uint32: JSON value will be a decimal number. Either numbers or strings are accepted.
            case ScalarType$1.INT32:
            case ScalarType$1.FIXED32:
            case ScalarType$1.SFIXED32:
            case ScalarType$1.SINT32:
            case ScalarType$1.UINT32:
                let int32;
                if (typeof json == "number")
                    int32 = json;
                else if (typeof json == "string" && json.length > 0) {
                    if (json.trim().length === json.length)
                        int32 = Number(json);
                }
                if (int32 === undefined)
                    break;
                if (type == ScalarType$1.UINT32 || type == ScalarType$1.FIXED32)
                    assertUInt32(int32);
                else
                    assertInt32(int32);
                return int32;
            // int64, fixed64, uint64: JSON value will be a decimal string. Either numbers or strings are accepted.
            case ScalarType$1.INT64:
            case ScalarType$1.SFIXED64:
            case ScalarType$1.SINT64:
                if (typeof json != "number" && typeof json != "string")
                    break;
                const long = protoInt64.parse(json);
                // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
                return longType ? long.toString() : long;
            case ScalarType$1.FIXED64:
            case ScalarType$1.UINT64:
                if (typeof json != "number" && typeof json != "string")
                    break;
                const uLong = protoInt64.uParse(json);
                // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
                return longType ? uLong.toString() : uLong;
            // bool:
            case ScalarType$1.BOOL:
                if (typeof json !== "boolean")
                    break;
                return json;
            // string:
            case ScalarType$1.STRING:
                if (typeof json !== "string") {
                    break;
                }
                // A string must always contain UTF-8 encoded or 7-bit ASCII.
                // We validate with encodeURIComponent, which appears to be the fastest widely available option.
                try {
                    encodeURIComponent(json);
                }
                catch (e) {
                    throw new Error("invalid UTF8");
                }
                return json;
            // bytes: JSON value will be the data encoded as a string using standard base64 encoding with paddings.
            // Either standard or URL-safe base64 encoding with/without paddings are accepted.
            case ScalarType$1.BYTES:
                if (json === "")
                    return new Uint8Array(0);
                if (typeof json !== "string")
                    break;
                return protoBase64.dec(json);
        }
        throw new Error();
    }
    function readEnum(type, json, ignoreUnknownFields, nullAsZeroValue) {
        if (json === null) {
            if (type.typeName == "google.protobuf.NullValue") {
                return 0; // google.protobuf.NullValue.NULL_VALUE = 0
            }
            return nullAsZeroValue ? type.values[0].no : tokenNull;
        }
        // eslint-disable-next-line @typescript-eslint/switch-exhaustiveness-check
        switch (typeof json) {
            case "number":
                if (Number.isInteger(json)) {
                    return json;
                }
                break;
            case "string":
                const value = type.findName(json);
                if (value !== undefined) {
                    return value.no;
                }
                if (ignoreUnknownFields) {
                    return tokenIgnoredUnknownEnum;
                }
                break;
        }
        throw new Error(`cannot decode enum ${type.typeName} from JSON: ${debugJsonValue(json)}`);
    }
    // Decide whether an unset field should be emitted with JSON write option `emitDefaultValues`
    function canEmitFieldDefaultValue(field) {
        if (field.repeated || field.kind == "map") {
            // maps are {}, repeated fields are []
            return true;
        }
        if (field.oneof) {
            // oneof fields are never emitted
            return false;
        }
        if (field.kind == "message") {
            // singular message field are allowed to emit JSON null, but we do not
            return false;
        }
        // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
        if (field.opt || field.req) {
            // the field uses explicit presence, so we cannot emit a zero value
            return false;
        }
        return true;
    }
    function writeField$1(field, value, options) {
        if (field.kind == "map") {
            assert(typeof value == "object" && value != null);
            const jsonObj = {};
            const entries = Object.entries(value);
            switch (field.V.kind) {
                case "scalar":
                    for (const [entryKey, entryValue] of entries) {
                        jsonObj[entryKey.toString()] = writeScalar$1(field.V.T, entryValue); // JSON standard allows only (double quoted) string as property key
                    }
                    break;
                case "message":
                    for (const [entryKey, entryValue] of entries) {
                        // JSON standard allows only (double quoted) string as property key
                        jsonObj[entryKey.toString()] = entryValue.toJson(options);
                    }
                    break;
                case "enum":
                    const enumType = field.V.T;
                    for (const [entryKey, entryValue] of entries) {
                        // JSON standard allows only (double quoted) string as property key
                        jsonObj[entryKey.toString()] = writeEnum(enumType, entryValue, options.enumAsInteger);
                    }
                    break;
            }
            return options.emitDefaultValues || entries.length > 0
                ? jsonObj
                : undefined;
        }
        if (field.repeated) {
            assert(Array.isArray(value));
            const jsonArr = [];
            switch (field.kind) {
                case "scalar":
                    for (let i = 0; i < value.length; i++) {
                        jsonArr.push(writeScalar$1(field.T, value[i]));
                    }
                    break;
                case "enum":
                    for (let i = 0; i < value.length; i++) {
                        jsonArr.push(writeEnum(field.T, value[i], options.enumAsInteger));
                    }
                    break;
                case "message":
                    for (let i = 0; i < value.length; i++) {
                        jsonArr.push(value[i].toJson(options));
                    }
                    break;
            }
            return options.emitDefaultValues || jsonArr.length > 0
                ? jsonArr
                : undefined;
        }
        switch (field.kind) {
            case "scalar":
                return writeScalar$1(field.T, value);
            case "enum":
                return writeEnum(field.T, value, options.enumAsInteger);
            case "message":
                return wrapField(field.T, value).toJson(options);
        }
    }
    function writeEnum(type, value, enumAsInteger) {
        var _a;
        assert(typeof value == "number");
        if (type.typeName == "google.protobuf.NullValue") {
            return null;
        }
        if (enumAsInteger) {
            return value;
        }
        const val = type.findNumber(value);
        return (_a = val === null || val === void 0 ? void 0 : val.name) !== null && _a !== void 0 ? _a : value; // if we don't know the enum value, just return the number
    }
    function writeScalar$1(type, value) {
        switch (type) {
            // int32, fixed32, uint32: JSON value will be a decimal number. Either numbers or strings are accepted.
            case ScalarType$1.INT32:
            case ScalarType$1.SFIXED32:
            case ScalarType$1.SINT32:
            case ScalarType$1.FIXED32:
            case ScalarType$1.UINT32:
                assert(typeof value == "number");
                return value;
            // float, double: JSON value will be a number or one of the special string values "NaN", "Infinity", and "-Infinity".
            // Either numbers or strings are accepted. Exponent notation is also accepted.
            case ScalarType$1.FLOAT:
            // assertFloat32(value);
            case ScalarType$1.DOUBLE: // eslint-disable-line no-fallthrough
                assert(typeof value == "number");
                if (Number.isNaN(value))
                    return "NaN";
                if (value === Number.POSITIVE_INFINITY)
                    return "Infinity";
                if (value === Number.NEGATIVE_INFINITY)
                    return "-Infinity";
                return value;
            // string:
            case ScalarType$1.STRING:
                assert(typeof value == "string");
                return value;
            // bool:
            case ScalarType$1.BOOL:
                assert(typeof value == "boolean");
                return value;
            // JSON value will be a decimal string. Either numbers or strings are accepted.
            case ScalarType$1.UINT64:
            case ScalarType$1.FIXED64:
            case ScalarType$1.INT64:
            case ScalarType$1.SFIXED64:
            case ScalarType$1.SINT64:
                assert(typeof value == "bigint" ||
                    typeof value == "string" ||
                    typeof value == "number");
                return value.toString();
            // bytes: JSON value will be the data encoded as a string using standard base64 encoding with paddings.
            // Either standard or URL-safe base64 encoding with/without paddings are accepted.
            case ScalarType$1.BYTES:
                assert(value instanceof Uint8Array);
                return protoBase64.enc(value);
        }
    }

    // Copyright 2021-2024 Buf Technologies, Inc.
    //
    // Licensed under the Apache License, Version 2.0 (the "License");
    // you may not use this file except in compliance with the License.
    // You may obtain a copy of the License at
    //
    //      http://www.apache.org/licenses/LICENSE-2.0
    //
    // Unless required by applicable law or agreed to in writing, software
    // distributed under the License is distributed on an "AS IS" BASIS,
    // WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
    // See the License for the specific language governing permissions and
    // limitations under the License.
    /* eslint-disable prefer-const,no-case-declarations,@typescript-eslint/no-explicit-any,@typescript-eslint/no-unsafe-argument,@typescript-eslint/no-unsafe-assignment,@typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-return */
    const unknownFieldsSymbol = Symbol("@bufbuild/protobuf/unknown-fields");
    // Default options for parsing binary data.
    const readDefaults = {
        readUnknownFields: true,
        readerFactory: (bytes) => new BinaryReader(bytes),
    };
    // Default options for serializing binary data.
    const writeDefaults = {
        writeUnknownFields: true,
        writerFactory: () => new BinaryWriter(),
    };
    function makeReadOptions(options) {
        return options ? Object.assign(Object.assign({}, readDefaults), options) : readDefaults;
    }
    function makeWriteOptions(options) {
        return options ? Object.assign(Object.assign({}, writeDefaults), options) : writeDefaults;
    }
    function makeBinaryFormat() {
        return {
            makeReadOptions,
            makeWriteOptions,
            listUnknownFields(message) {
                var _a;
                return (_a = message[unknownFieldsSymbol]) !== null && _a !== void 0 ? _a : [];
            },
            discardUnknownFields(message) {
                delete message[unknownFieldsSymbol];
            },
            writeUnknownFields(message, writer) {
                const m = message;
                const c = m[unknownFieldsSymbol];
                if (c) {
                    for (const f of c) {
                        writer.tag(f.no, f.wireType).raw(f.data);
                    }
                }
            },
            onUnknownField(message, no, wireType, data) {
                const m = message;
                if (!Array.isArray(m[unknownFieldsSymbol])) {
                    m[unknownFieldsSymbol] = [];
                }
                m[unknownFieldsSymbol].push({ no, wireType, data });
            },
            readMessage(message, reader, lengthOrEndTagFieldNo, options, delimitedMessageEncoding) {
                const type = message.getType();
                // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
                const end = delimitedMessageEncoding
                    ? reader.len
                    : reader.pos + lengthOrEndTagFieldNo;
                let fieldNo, wireType;
                while (reader.pos < end) {
                    [fieldNo, wireType] = reader.tag();
                    if (delimitedMessageEncoding === true &&
                        wireType == WireType.EndGroup) {
                        break;
                    }
                    const field = type.fields.find(fieldNo);
                    if (!field) {
                        const data = reader.skip(wireType, fieldNo);
                        if (options.readUnknownFields) {
                            this.onUnknownField(message, fieldNo, wireType, data);
                        }
                        continue;
                    }
                    readField(message, reader, field, wireType, options);
                }
                if (delimitedMessageEncoding && // eslint-disable-line @typescript-eslint/strict-boolean-expressions
                    (wireType != WireType.EndGroup || fieldNo !== lengthOrEndTagFieldNo)) {
                    throw new Error(`invalid end group tag`);
                }
            },
            readField,
            writeMessage(message, writer, options) {
                const type = message.getType();
                for (const field of type.fields.byNumber()) {
                    if (!isFieldSet(field, message)) {
                        if (field.req) {
                            throw new Error(`cannot encode field ${type.typeName}.${field.name} to binary: required field not set`);
                        }
                        continue;
                    }
                    const value = field.oneof
                        ? message[field.oneof.localName].value
                        : message[field.localName];
                    writeField(field, value, writer, options);
                }
                if (options.writeUnknownFields) {
                    this.writeUnknownFields(message, writer);
                }
                return writer;
            },
            writeField(field, value, writer, options) {
                // The behavior of our internal function has changed, it does no longer
                // accept `undefined` values for singular scalar and map.
                // For backwards-compatibility, we support the old form that is part of
                // the public API through the interface BinaryFormat.
                if (value === undefined) {
                    return undefined;
                }
                writeField(field, value, writer, options);
            },
        };
    }
    function readField(target, // eslint-disable-line @typescript-eslint/no-explicit-any -- `any` is the best choice for dynamic access
    reader, field, wireType, options) {
        let { repeated, localName } = field;
        if (field.oneof) {
            target = target[field.oneof.localName];
            if (target.case != localName) {
                delete target.value;
            }
            target.case = localName;
            localName = "value";
        }
        switch (field.kind) {
            case "scalar":
            case "enum":
                const scalarType = field.kind == "enum" ? ScalarType$1.INT32 : field.T;
                let read = readScalar;
                // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison -- acceptable since it's covered by tests
                if (field.kind == "scalar" && field.L > 0) {
                    read = readScalarLTString;
                }
                if (repeated) {
                    let arr = target[localName]; // safe to assume presence of array, oneof cannot contain repeated values
                    const isPacked = wireType == WireType.LengthDelimited &&
                        scalarType != ScalarType$1.STRING &&
                        scalarType != ScalarType$1.BYTES;
                    if (isPacked) {
                        let e = reader.uint32() + reader.pos;
                        while (reader.pos < e) {
                            arr.push(read(reader, scalarType));
                        }
                    }
                    else {
                        arr.push(read(reader, scalarType));
                    }
                }
                else {
                    target[localName] = read(reader, scalarType);
                }
                break;
            case "message":
                const messageType = field.T;
                if (repeated) {
                    // safe to assume presence of array, oneof cannot contain repeated values
                    target[localName].push(readMessageField(reader, new messageType(), options, field));
                }
                else {
                    if (isMessage(target[localName])) {
                        readMessageField(reader, target[localName], options, field);
                    }
                    else {
                        target[localName] = readMessageField(reader, new messageType(), options, field);
                        if (messageType.fieldWrapper && !field.oneof && !field.repeated) {
                            target[localName] = messageType.fieldWrapper.unwrapField(target[localName]);
                        }
                    }
                }
                break;
            case "map":
                let [mapKey, mapVal] = readMapEntry(field, reader, options);
                // safe to assume presence of map object, oneof cannot contain repeated values
                target[localName][mapKey] = mapVal;
                break;
        }
    }
    // Read a message, avoiding MessageType.fromBinary() to re-use the
    // BinaryReadOptions and the IBinaryReader.
    function readMessageField(reader, message, options, field) {
        const format = message.getType().runtime.bin;
        const delimited = field === null || field === void 0 ? void 0 : field.delimited;
        format.readMessage(message, reader, delimited ? field.no : reader.uint32(), // eslint-disable-line @typescript-eslint/strict-boolean-expressions
        options, delimited);
        return message;
    }
    // Read a map field, expecting key field = 1, value field = 2
    function readMapEntry(field, reader, options) {
        const length = reader.uint32(), end = reader.pos + length;
        let key, val;
        while (reader.pos < end) {
            const [fieldNo] = reader.tag();
            switch (fieldNo) {
                case 1:
                    key = readScalar(reader, field.K);
                    break;
                case 2:
                    switch (field.V.kind) {
                        case "scalar":
                            val = readScalar(reader, field.V.T);
                            break;
                        case "enum":
                            val = reader.int32();
                            break;
                        case "message":
                            val = readMessageField(reader, new field.V.T(), options, undefined);
                            break;
                    }
                    break;
            }
        }
        if (key === undefined) {
            key = scalarZeroValue(field.K, LongType.BIGINT);
        }
        if (typeof key != "string" && typeof key != "number") {
            key = key.toString();
        }
        if (val === undefined) {
            switch (field.V.kind) {
                case "scalar":
                    val = scalarZeroValue(field.V.T, LongType.BIGINT);
                    break;
                case "enum":
                    val = field.V.T.values[0].no;
                    break;
                case "message":
                    val = new field.V.T();
                    break;
            }
        }
        return [key, val];
    }
    // Read a scalar value, but return 64 bit integral types (int64, uint64,
    // sint64, fixed64, sfixed64) as string instead of bigint.
    function readScalarLTString(reader, type) {
        const v = readScalar(reader, type);
        return typeof v == "bigint" ? v.toString() : v;
    }
    // Does not use scalarTypeInfo() for better performance.
    function readScalar(reader, type) {
        switch (type) {
            case ScalarType$1.STRING:
                return reader.string();
            case ScalarType$1.BOOL:
                return reader.bool();
            case ScalarType$1.DOUBLE:
                return reader.double();
            case ScalarType$1.FLOAT:
                return reader.float();
            case ScalarType$1.INT32:
                return reader.int32();
            case ScalarType$1.INT64:
                return reader.int64();
            case ScalarType$1.UINT64:
                return reader.uint64();
            case ScalarType$1.FIXED64:
                return reader.fixed64();
            case ScalarType$1.BYTES:
                return reader.bytes();
            case ScalarType$1.FIXED32:
                return reader.fixed32();
            case ScalarType$1.SFIXED32:
                return reader.sfixed32();
            case ScalarType$1.SFIXED64:
                return reader.sfixed64();
            case ScalarType$1.SINT64:
                return reader.sint64();
            case ScalarType$1.UINT32:
                return reader.uint32();
            case ScalarType$1.SINT32:
                return reader.sint32();
        }
    }
    function writeField(field, value, writer, options) {
        assert(value !== undefined);
        const repeated = field.repeated;
        switch (field.kind) {
            case "scalar":
            case "enum":
                let scalarType = field.kind == "enum" ? ScalarType$1.INT32 : field.T;
                if (repeated) {
                    assert(Array.isArray(value));
                    if (field.packed) {
                        writePacked(writer, scalarType, field.no, value);
                    }
                    else {
                        for (const item of value) {
                            writeScalar(writer, scalarType, field.no, item);
                        }
                    }
                }
                else {
                    writeScalar(writer, scalarType, field.no, value);
                }
                break;
            case "message":
                if (repeated) {
                    assert(Array.isArray(value));
                    for (const item of value) {
                        writeMessageField(writer, options, field, item);
                    }
                }
                else {
                    writeMessageField(writer, options, field, value);
                }
                break;
            case "map":
                assert(typeof value == "object" && value != null);
                for (const [key, val] of Object.entries(value)) {
                    writeMapEntry(writer, options, field, key, val);
                }
                break;
        }
    }
    function writeMapEntry(writer, options, field, key, value) {
        writer.tag(field.no, WireType.LengthDelimited);
        writer.fork();
        // javascript only allows number or string for object properties
        // we convert from our representation to the protobuf type
        let keyValue = key;
        // eslint-disable-next-line @typescript-eslint/switch-exhaustiveness-check -- we deliberately handle just the special cases for map keys
        switch (field.K) {
            case ScalarType$1.INT32:
            case ScalarType$1.FIXED32:
            case ScalarType$1.UINT32:
            case ScalarType$1.SFIXED32:
            case ScalarType$1.SINT32:
                keyValue = Number.parseInt(key);
                break;
            case ScalarType$1.BOOL:
                assert(key == "true" || key == "false");
                keyValue = key == "true";
                break;
        }
        // write key, expecting key field number = 1
        writeScalar(writer, field.K, 1, keyValue);
        // write value, expecting value field number = 2
        switch (field.V.kind) {
            case "scalar":
                writeScalar(writer, field.V.T, 2, value);
                break;
            case "enum":
                writeScalar(writer, ScalarType$1.INT32, 2, value);
                break;
            case "message":
                assert(value !== undefined);
                writer.tag(2, WireType.LengthDelimited).bytes(value.toBinary(options));
                break;
        }
        writer.join();
    }
    // Value must not be undefined
    function writeMessageField(writer, options, field, value) {
        const message = wrapField(field.T, value);
        // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
        if (field.delimited)
            writer
                .tag(field.no, WireType.StartGroup)
                .raw(message.toBinary(options))
                .tag(field.no, WireType.EndGroup);
        else
            writer
                .tag(field.no, WireType.LengthDelimited)
                .bytes(message.toBinary(options));
    }
    function writeScalar(writer, type, fieldNo, value) {
        assert(value !== undefined);
        let [wireType, method] = scalarTypeInfo(type);
        writer.tag(fieldNo, wireType)[method](value);
    }
    function writePacked(writer, type, fieldNo, value) {
        if (!value.length) {
            return;
        }
        writer.tag(fieldNo, WireType.LengthDelimited).fork();
        let [, method] = scalarTypeInfo(type);
        for (let i = 0; i < value.length; i++) {
            writer[method](value[i]);
        }
        writer.join();
    }
    /**
     * Get information for writing a scalar value.
     *
     * Returns tuple:
     * [0]: appropriate WireType
     * [1]: name of the appropriate method of IBinaryWriter
     * [2]: whether the given value is a default value for proto3 semantics
     *
     * If argument `value` is omitted, [2] is always false.
     */
    // TODO replace call-sites writeScalar() and writePacked(), then remove
    function scalarTypeInfo(type) {
        let wireType = WireType.Varint;
        // eslint-disable-next-line @typescript-eslint/switch-exhaustiveness-check -- INT32, UINT32, SINT32 are covered by the defaults
        switch (type) {
            case ScalarType$1.BYTES:
            case ScalarType$1.STRING:
                wireType = WireType.LengthDelimited;
                break;
            case ScalarType$1.DOUBLE:
            case ScalarType$1.FIXED64:
            case ScalarType$1.SFIXED64:
                wireType = WireType.Bit64;
                break;
            case ScalarType$1.FIXED32:
            case ScalarType$1.SFIXED32:
            case ScalarType$1.FLOAT:
                wireType = WireType.Bit32;
                break;
        }
        const method = ScalarType$1[type].toLowerCase();
        return [wireType, method];
    }

    // Copyright 2021-2024 Buf Technologies, Inc.
    //
    // Licensed under the Apache License, Version 2.0 (the "License");
    // you may not use this file except in compliance with the License.
    // You may obtain a copy of the License at
    //
    //      http://www.apache.org/licenses/LICENSE-2.0
    //
    // Unless required by applicable law or agreed to in writing, software
    // distributed under the License is distributed on an "AS IS" BASIS,
    // WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
    // See the License for the specific language governing permissions and
    // limitations under the License.
    /* eslint-disable @typescript-eslint/no-explicit-any,@typescript-eslint/no-unsafe-assignment,@typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-return,@typescript-eslint/no-unsafe-argument,no-case-declarations */
    function makeUtilCommon() {
        return {
            setEnumType,
            initPartial(source, target) {
                if (source === undefined) {
                    return;
                }
                const type = target.getType();
                for (const member of type.fields.byMember()) {
                    const localName = member.localName, t = target, s = source;
                    if (s[localName] == null) {
                        // TODO if source is a Message instance, we should use isFieldSet() here to support future field presence
                        continue;
                    }
                    switch (member.kind) {
                        case "oneof":
                            const sk = s[localName].case;
                            if (sk === undefined) {
                                continue;
                            }
                            const sourceField = member.findField(sk);
                            let val = s[localName].value;
                            if (sourceField &&
                                sourceField.kind == "message" &&
                                !isMessage(val, sourceField.T)) {
                                val = new sourceField.T(val);
                            }
                            else if (sourceField &&
                                sourceField.kind === "scalar" &&
                                sourceField.T === ScalarType$1.BYTES) {
                                val = toU8Arr(val);
                            }
                            t[localName] = { case: sk, value: val };
                            break;
                        case "scalar":
                        case "enum":
                            let copy = s[localName];
                            if (member.T === ScalarType$1.BYTES) {
                                copy = member.repeated
                                    ? copy.map(toU8Arr)
                                    : toU8Arr(copy);
                            }
                            t[localName] = copy;
                            break;
                        case "map":
                            switch (member.V.kind) {
                                case "scalar":
                                case "enum":
                                    if (member.V.T === ScalarType$1.BYTES) {
                                        for (const [k, v] of Object.entries(s[localName])) {
                                            t[localName][k] = toU8Arr(v);
                                        }
                                    }
                                    else {
                                        Object.assign(t[localName], s[localName]);
                                    }
                                    break;
                                case "message":
                                    const messageType = member.V.T;
                                    for (const k of Object.keys(s[localName])) {
                                        let val = s[localName][k];
                                        if (!messageType.fieldWrapper) {
                                            // We only take partial input for messages that are not a wrapper type.
                                            // For those messages, we recursively normalize the partial input.
                                            val = new messageType(val);
                                        }
                                        t[localName][k] = val;
                                    }
                                    break;
                            }
                            break;
                        case "message":
                            const mt = member.T;
                            if (member.repeated) {
                                t[localName] = s[localName].map((val) => isMessage(val, mt) ? val : new mt(val));
                            }
                            else {
                                const val = s[localName];
                                if (mt.fieldWrapper) {
                                    if (
                                    // We can't use BytesValue.typeName as that will create a circular import
                                    mt.typeName === "google.protobuf.BytesValue") {
                                        t[localName] = toU8Arr(val);
                                    }
                                    else {
                                        t[localName] = val;
                                    }
                                }
                                else {
                                    t[localName] = isMessage(val, mt) ? val : new mt(val);
                                }
                            }
                            break;
                    }
                }
            },
            // TODO use isFieldSet() here to support future field presence
            equals(type, a, b) {
                if (a === b) {
                    return true;
                }
                if (!a || !b) {
                    return false;
                }
                return type.fields.byMember().every((m) => {
                    const va = a[m.localName];
                    const vb = b[m.localName];
                    if (m.repeated) {
                        if (va.length !== vb.length) {
                            return false;
                        }
                        // eslint-disable-next-line @typescript-eslint/switch-exhaustiveness-check -- repeated fields are never "map"
                        switch (m.kind) {
                            case "message":
                                return va.every((a, i) => m.T.equals(a, vb[i]));
                            case "scalar":
                                return va.every((a, i) => scalarEquals(m.T, a, vb[i]));
                            case "enum":
                                return va.every((a, i) => scalarEquals(ScalarType$1.INT32, a, vb[i]));
                        }
                        throw new Error(`repeated cannot contain ${m.kind}`);
                    }
                    switch (m.kind) {
                        case "message":
                            return m.T.equals(va, vb);
                        case "enum":
                            return scalarEquals(ScalarType$1.INT32, va, vb);
                        case "scalar":
                            return scalarEquals(m.T, va, vb);
                        case "oneof":
                            if (va.case !== vb.case) {
                                return false;
                            }
                            const s = m.findField(va.case);
                            if (s === undefined) {
                                return true;
                            }
                            // eslint-disable-next-line @typescript-eslint/switch-exhaustiveness-check -- oneof fields are never "map"
                            switch (s.kind) {
                                case "message":
                                    return s.T.equals(va.value, vb.value);
                                case "enum":
                                    return scalarEquals(ScalarType$1.INT32, va.value, vb.value);
                                case "scalar":
                                    return scalarEquals(s.T, va.value, vb.value);
                            }
                            throw new Error(`oneof cannot contain ${s.kind}`);
                        case "map":
                            const keys = Object.keys(va).concat(Object.keys(vb));
                            switch (m.V.kind) {
                                case "message":
                                    const messageType = m.V.T;
                                    return keys.every((k) => messageType.equals(va[k], vb[k]));
                                case "enum":
                                    return keys.every((k) => scalarEquals(ScalarType$1.INT32, va[k], vb[k]));
                                case "scalar":
                                    const scalarType = m.V.T;
                                    return keys.every((k) => scalarEquals(scalarType, va[k], vb[k]));
                            }
                            break;
                    }
                });
            },
            // TODO use isFieldSet() here to support future field presence
            clone(message) {
                const type = message.getType(), target = new type(), any = target;
                for (const member of type.fields.byMember()) {
                    const source = message[member.localName];
                    let copy;
                    if (member.repeated) {
                        copy = source.map(cloneSingularField);
                    }
                    else if (member.kind == "map") {
                        copy = any[member.localName];
                        for (const [key, v] of Object.entries(source)) {
                            copy[key] = cloneSingularField(v);
                        }
                    }
                    else if (member.kind == "oneof") {
                        const f = member.findField(source.case);
                        copy = f
                            ? { case: source.case, value: cloneSingularField(source.value) }
                            : { case: undefined };
                    }
                    else {
                        copy = cloneSingularField(source);
                    }
                    any[member.localName] = copy;
                }
                for (const uf of type.runtime.bin.listUnknownFields(message)) {
                    type.runtime.bin.onUnknownField(any, uf.no, uf.wireType, uf.data);
                }
                return target;
            },
        };
    }
    // clone a single field value - i.e. the element type of repeated fields, the value type of maps
    function cloneSingularField(value) {
        if (value === undefined) {
            return value;
        }
        if (isMessage(value)) {
            return value.clone();
        }
        if (value instanceof Uint8Array) {
            const c = new Uint8Array(value.byteLength);
            c.set(value);
            return c;
        }
        return value;
    }
    // converts any ArrayLike<number> to Uint8Array if necessary.
    function toU8Arr(input) {
        return input instanceof Uint8Array ? input : new Uint8Array(input);
    }

    // Copyright 2021-2024 Buf Technologies, Inc.
    //
    // Licensed under the Apache License, Version 2.0 (the "License");
    // you may not use this file except in compliance with the License.
    // You may obtain a copy of the License at
    //
    //      http://www.apache.org/licenses/LICENSE-2.0
    //
    // Unless required by applicable law or agreed to in writing, software
    // distributed under the License is distributed on an "AS IS" BASIS,
    // WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
    // See the License for the specific language governing permissions and
    // limitations under the License.
    function makeProtoRuntime(syntax, newFieldList, initFields) {
        return {
            syntax,
            json: makeJsonFormat(),
            bin: makeBinaryFormat(),
            util: Object.assign(Object.assign({}, makeUtilCommon()), { newFieldList,
                initFields }),
            makeMessageType(typeName, fields, opt) {
                return makeMessageType(this, typeName, fields, opt);
            },
            makeEnum,
            makeEnumType,
            getEnumType,
            makeExtension(typeName, extendee, field) {
                return makeExtension(this, typeName, extendee, field);
            },
        };
    }

    // Copyright 2021-2024 Buf Technologies, Inc.
    //
    // Licensed under the Apache License, Version 2.0 (the "License");
    // you may not use this file except in compliance with the License.
    // You may obtain a copy of the License at
    //
    //      http://www.apache.org/licenses/LICENSE-2.0
    //
    // Unless required by applicable law or agreed to in writing, software
    // distributed under the License is distributed on an "AS IS" BASIS,
    // WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
    // See the License for the specific language governing permissions and
    // limitations under the License.
    class InternalFieldList {
        constructor(fields, normalizer) {
            this._fields = fields;
            this._normalizer = normalizer;
        }
        findJsonName(jsonName) {
            if (!this.jsonNames) {
                const t = {};
                for (const f of this.list()) {
                    t[f.jsonName] = t[f.name] = f;
                }
                this.jsonNames = t;
            }
            return this.jsonNames[jsonName];
        }
        find(fieldNo) {
            if (!this.numbers) {
                const t = {};
                for (const f of this.list()) {
                    t[f.no] = f;
                }
                this.numbers = t;
            }
            return this.numbers[fieldNo];
        }
        list() {
            if (!this.all) {
                this.all = this._normalizer(this._fields);
            }
            return this.all;
        }
        byNumber() {
            if (!this.numbersAsc) {
                this.numbersAsc = this.list()
                    .concat()
                    .sort((a, b) => a.no - b.no);
            }
            return this.numbersAsc;
        }
        byMember() {
            if (!this.members) {
                this.members = [];
                const a = this.members;
                let o;
                for (const f of this.list()) {
                    if (f.oneof) {
                        if (f.oneof !== o) {
                            o = f.oneof;
                            a.push(o);
                        }
                    }
                    else {
                        a.push(f);
                    }
                }
            }
            return this.members;
        }
    }

    // Copyright 2021-2024 Buf Technologies, Inc.
    //
    // Licensed under the Apache License, Version 2.0 (the "License");
    // you may not use this file except in compliance with the License.
    // You may obtain a copy of the License at
    //
    //      http://www.apache.org/licenses/LICENSE-2.0
    //
    // Unless required by applicable law or agreed to in writing, software
    // distributed under the License is distributed on an "AS IS" BASIS,
    // WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
    // See the License for the specific language governing permissions and
    // limitations under the License.
    /**
     * Returns the name of a protobuf element in generated code.
     *
     * Field names - including oneofs - are converted to lowerCamelCase. For
     * messages, enumerations and services, the package name is stripped from
     * the type name. For nested messages and enumerations, the names are joined
     * with an underscore. For methods, the first character is made lowercase.
     */
    /**
     * Returns the name of a field in generated code.
     */
    function localFieldName(protoName, inOneof) {
        const name = protoCamelCase(protoName);
        if (inOneof) {
            // oneof member names are not properties, but values of the `case` property.
            return name;
        }
        return safeObjectProperty(safeMessageProperty(name));
    }
    /**
     * Returns the name of a oneof group in generated code.
     */
    function localOneofName(protoName) {
        return localFieldName(protoName, false);
    }
    /**
     * Returns the JSON name for a protobuf field, exactly like protoc does.
     */
    const fieldJsonName = protoCamelCase;
    /**
     * Converts snake_case to protoCamelCase according to the convention
     * used by protoc to convert a field name to a JSON name.
     */
    function protoCamelCase(snakeCase) {
        let capNext = false;
        const b = [];
        for (let i = 0; i < snakeCase.length; i++) {
            let c = snakeCase.charAt(i);
            switch (c) {
                case "_":
                    capNext = true;
                    break;
                case "0":
                case "1":
                case "2":
                case "3":
                case "4":
                case "5":
                case "6":
                case "7":
                case "8":
                case "9":
                    b.push(c);
                    capNext = false;
                    break;
                default:
                    if (capNext) {
                        capNext = false;
                        c = c.toUpperCase();
                    }
                    b.push(c);
                    break;
            }
        }
        return b.join("");
    }
    /**
     * Names that cannot be used for object properties because they are reserved
     * by built-in JavaScript properties.
     */
    const reservedObjectProperties = new Set([
        // names reserved by JavaScript
        "constructor",
        "toString",
        "toJSON",
        "valueOf",
    ]);
    /**
     * Names that cannot be used for object properties because they are reserved
     * by the runtime.
     */
    const reservedMessageProperties = new Set([
        // names reserved by the runtime
        "getType",
        "clone",
        "equals",
        "fromBinary",
        "fromJson",
        "fromJsonString",
        "toBinary",
        "toJson",
        "toJsonString",
        // names reserved by the runtime for the future
        "toObject",
    ]);
    const fallback = (name) => `${name}$`;
    /**
     * Will wrap names that are Object prototype properties or names reserved
     * for `Message`s.
     */
    const safeMessageProperty = (name) => {
        if (reservedMessageProperties.has(name)) {
            return fallback(name);
        }
        return name;
    };
    /**
     * Names that cannot be used for object properties because they are reserved
     * by built-in JavaScript properties.
     */
    const safeObjectProperty = (name) => {
        if (reservedObjectProperties.has(name)) {
            return fallback(name);
        }
        return name;
    };

    // Copyright 2021-2024 Buf Technologies, Inc.
    //
    // Licensed under the Apache License, Version 2.0 (the "License");
    // you may not use this file except in compliance with the License.
    // You may obtain a copy of the License at
    //
    //      http://www.apache.org/licenses/LICENSE-2.0
    //
    // Unless required by applicable law or agreed to in writing, software
    // distributed under the License is distributed on an "AS IS" BASIS,
    // WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
    // See the License for the specific language governing permissions and
    // limitations under the License.
    class InternalOneofInfo {
        constructor(name) {
            this.kind = "oneof";
            this.repeated = false;
            this.packed = false;
            this.opt = false;
            this.req = false;
            this.default = undefined;
            this.fields = [];
            this.name = name;
            this.localName = localOneofName(name);
        }
        addField(field) {
            assert(field.oneof === this, `field ${field.name} not one of ${this.name}`);
            this.fields.push(field);
        }
        findField(localName) {
            if (!this._lookup) {
                this._lookup = Object.create(null);
                for (let i = 0; i < this.fields.length; i++) {
                    this._lookup[this.fields[i].localName] = this.fields[i];
                }
            }
            return this._lookup[localName];
        }
    }

    // Copyright 2021-2024 Buf Technologies, Inc.
    //
    // Licensed under the Apache License, Version 2.0 (the "License");
    // you may not use this file except in compliance with the License.
    // You may obtain a copy of the License at
    //
    //      http://www.apache.org/licenses/LICENSE-2.0
    //
    // Unless required by applicable law or agreed to in writing, software
    // distributed under the License is distributed on an "AS IS" BASIS,
    // WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
    // See the License for the specific language governing permissions and
    // limitations under the License.
    /**
     * Convert a collection of field info to an array of normalized FieldInfo.
     *
     * The argument `packedByDefault` specifies whether fields that do not specify
     * `packed` should be packed (proto3) or unpacked (proto2).
     */
    function normalizeFieldInfos(fieldInfos, packedByDefault) {
        var _a, _b, _c, _d, _e, _f;
        const r = [];
        let o;
        for (const field of typeof fieldInfos == "function"
            ? fieldInfos()
            : fieldInfos) {
            const f = field;
            f.localName = localFieldName(field.name, field.oneof !== undefined);
            f.jsonName = (_a = field.jsonName) !== null && _a !== void 0 ? _a : fieldJsonName(field.name);
            f.repeated = (_b = field.repeated) !== null && _b !== void 0 ? _b : false;
            if (field.kind == "scalar") {
                f.L = (_c = field.L) !== null && _c !== void 0 ? _c : LongType.BIGINT;
            }
            f.delimited = (_d = field.delimited) !== null && _d !== void 0 ? _d : false;
            f.req = (_e = field.req) !== null && _e !== void 0 ? _e : false;
            f.opt = (_f = field.opt) !== null && _f !== void 0 ? _f : false;
            if (field.packed === undefined) {
                {
                    f.packed =
                        field.kind == "enum" ||
                            (field.kind == "scalar" &&
                                field.T != ScalarType$1.BYTES &&
                                field.T != ScalarType$1.STRING);
                }
            }
            // We do not surface options at this time
            // f.options = field.options ?? emptyReadonlyObject;
            if (field.oneof !== undefined) {
                const ooname = typeof field.oneof == "string" ? field.oneof : field.oneof.name;
                if (!o || o.name != ooname) {
                    o = new InternalOneofInfo(ooname);
                }
                f.oneof = o;
                o.addField(f);
            }
            r.push(f);
        }
        return r;
    }

    // Copyright 2021-2024 Buf Technologies, Inc.
    //
    // Licensed under the Apache License, Version 2.0 (the "License");
    // you may not use this file except in compliance with the License.
    // You may obtain a copy of the License at
    //
    //      http://www.apache.org/licenses/LICENSE-2.0
    //
    // Unless required by applicable law or agreed to in writing, software
    // distributed under the License is distributed on an "AS IS" BASIS,
    // WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
    // See the License for the specific language governing permissions and
    // limitations under the License.
    /**
     * Provides functionality for messages defined with the proto3 syntax.
     */
    const proto3 = makeProtoRuntime("proto3", (fields) => {
        return new InternalFieldList(fields, (source) => normalizeFieldInfos(source));
    }, 
    // TODO merge with proto2 and initExtensionField, also see initPartial, equals, clone
    (target) => {
        for (const member of target.getType().fields.byMember()) {
            if (member.opt) {
                continue;
            }
            const name = member.localName, t = target;
            if (member.repeated) {
                t[name] = [];
                continue;
            }
            switch (member.kind) {
                case "oneof":
                    t[name] = { case: undefined };
                    break;
                case "enum":
                    t[name] = 0;
                    break;
                case "map":
                    t[name] = {};
                    break;
                case "scalar":
                    t[name] = scalarZeroValue(member.T, member.L);
                    break;
            }
        }
    });

    // @generated by protoc-gen-es v1.10.0 with parameter "target=ts"
    // @generated from file mlt_tileset_metadata.proto (package mlt, syntax proto3)
    /* eslint-disable */
    // @ts-nocheck
    /**
     * @generated from enum mlt.ColumnScope
     */
    var ColumnScope;
    (function (ColumnScope) {
        /**
         * 1:1 Mapping of property and feature -> id and geometry
         *
         * @generated from enum value: FEATURE = 0;
         */
        ColumnScope[ColumnScope["FEATURE"] = 0] = "FEATURE";
        /**
         * For M-Values -> 1:1 Mapping for property and vertex
         *
         * @generated from enum value: VERTEX = 1;
         */
        ColumnScope[ColumnScope["VERTEX"] = 1] = "VERTEX";
    })(ColumnScope || (ColumnScope = {}));
    // Retrieve enum metadata with: proto3.getEnumType(ColumnScope)
    proto3.util.setEnumType(ColumnScope, "mlt.ColumnScope", [
        { no: 0, name: "FEATURE" },
        { no: 1, name: "VERTEX" },
    ]);
    /**
     * @generated from enum mlt.ScalarType
     */
    var ScalarType;
    (function (ScalarType) {
        /**
         * @generated from enum value: BOOLEAN = 0;
         */
        ScalarType[ScalarType["BOOLEAN"] = 0] = "BOOLEAN";
        /**
         * @generated from enum value: INT_8 = 1;
         */
        ScalarType[ScalarType["INT_8"] = 1] = "INT_8";
        /**
         * @generated from enum value: UINT_8 = 2;
         */
        ScalarType[ScalarType["UINT_8"] = 2] = "UINT_8";
        /**
         * @generated from enum value: INT_32 = 3;
         */
        ScalarType[ScalarType["INT_32"] = 3] = "INT_32";
        /**
         * @generated from enum value: UINT_32 = 4;
         */
        ScalarType[ScalarType["UINT_32"] = 4] = "UINT_32";
        /**
         * @generated from enum value: INT_64 = 5;
         */
        ScalarType[ScalarType["INT_64"] = 5] = "INT_64";
        /**
         * @generated from enum value: UINT_64 = 6;
         */
        ScalarType[ScalarType["UINT_64"] = 6] = "UINT_64";
        /**
         * @generated from enum value: FLOAT = 7;
         */
        ScalarType[ScalarType["FLOAT"] = 7] = "FLOAT";
        /**
         * @generated from enum value: DOUBLE = 8;
         */
        ScalarType[ScalarType["DOUBLE"] = 8] = "DOUBLE";
        /**
         * @generated from enum value: STRING = 9;
         */
        ScalarType[ScalarType["STRING"] = 9] = "STRING";
    })(ScalarType || (ScalarType = {}));
    // Retrieve enum metadata with: proto3.getEnumType(ScalarType)
    proto3.util.setEnumType(ScalarType, "mlt.ScalarType", [
        { no: 0, name: "BOOLEAN" },
        { no: 1, name: "INT_8" },
        { no: 2, name: "UINT_8" },
        { no: 3, name: "INT_32" },
        { no: 4, name: "UINT_32" },
        { no: 5, name: "INT_64" },
        { no: 6, name: "UINT_64" },
        { no: 7, name: "FLOAT" },
        { no: 8, name: "DOUBLE" },
        { no: 9, name: "STRING" },
    ]);
    /**
     * @generated from enum mlt.ComplexType
     */
    var ComplexType;
    (function (ComplexType) {
        /**
         * fixed size binary with 2 values of the same type either signed or unsigned Int8, Int32, Int64 as well as Float or Double
         *
         * @generated from enum value: VEC_2 = 0;
         */
        ComplexType[ComplexType["VEC_2"] = 0] = "VEC_2";
        /**
         * fixed size binary with 2 values of the same type either signed or unsigned Int8, Int32, Int64 as well as Float or Double
         *
         * @generated from enum value: VEC_3 = 1;
         */
        ComplexType[ComplexType["VEC_3"] = 1] = "VEC_3";
        /**
         * vec2<Int32> for the VertexBuffer stream with additional information (streams) about the topology
         *
         * @generated from enum value: GEOMETRY = 2;
         */
        ComplexType[ComplexType["GEOMETRY"] = 2] = "GEOMETRY";
        /**
         * vec3<Int32> for the VertexBuffer stream with additional information (streams) about the topology
         *
         * @generated from enum value: GEOMETRY_Z = 3;
         */
        ComplexType[ComplexType["GEOMETRY_Z"] = 3] = "GEOMETRY_Z";
        /**
         * @generated from enum value: LIST = 4;
         */
        ComplexType[ComplexType["LIST"] = 4] = "LIST";
        /**
         * @generated from enum value: MAP = 5;
         */
        ComplexType[ComplexType["MAP"] = 5] = "MAP";
        /**
         * @generated from enum value: STRUCT = 6;
         */
        ComplexType[ComplexType["STRUCT"] = 6] = "STRUCT";
    })(ComplexType || (ComplexType = {}));
    // Retrieve enum metadata with: proto3.getEnumType(ComplexType)
    proto3.util.setEnumType(ComplexType, "mlt.ComplexType", [
        { no: 0, name: "VEC_2" },
        { no: 1, name: "VEC_3" },
        { no: 2, name: "GEOMETRY" },
        { no: 3, name: "GEOMETRY_Z" },
        { no: 4, name: "LIST" },
        { no: 5, name: "MAP" },
        { no: 6, name: "STRUCT" },
    ]);
    /**
     * @generated from enum mlt.LogicalScalarType
     */
    var LogicalScalarType;
    (function (LogicalScalarType) {
        /**
         * physical type: Int64 -> number of milliseconds since Unix epoch
         *
         * @generated from enum value: TIMESTAMP = 0;
         */
        LogicalScalarType[LogicalScalarType["TIMESTAMP"] = 0] = "TIMESTAMP";
        /**
         * physical type: Int32 -> number of days since Unix epoch
         *
         * @generated from enum value: DATE = 1;
         */
        LogicalScalarType[LogicalScalarType["DATE"] = 1] = "DATE";
        /**
         * physical type: String
         *
         * @generated from enum value: JSON = 2;
         */
        LogicalScalarType[LogicalScalarType["JSON"] = 2] = "JSON";
    })(LogicalScalarType || (LogicalScalarType = {}));
    // Retrieve enum metadata with: proto3.getEnumType(LogicalScalarType)
    proto3.util.setEnumType(LogicalScalarType, "mlt.LogicalScalarType", [
        { no: 0, name: "TIMESTAMP" },
        { no: 1, name: "DATE" },
        { no: 2, name: "JSON" },
    ]);
    /**
     * @generated from enum mlt.LogicalComplexType
     */
    var LogicalComplexType;
    (function (LogicalComplexType) {
        /**
         * physical type: list<UInt8>
         *
         * @generated from enum value: BINARY = 0;
         */
        LogicalComplexType[LogicalComplexType["BINARY"] = 0] = "BINARY";
        /**
         * physical type: map<vec2<double, T>> -> special data structure which can be used for a efficient representation of linear referencing
         *
         * @generated from enum value: RANGE_MAP = 1;
         */
        LogicalComplexType[LogicalComplexType["RANGE_MAP"] = 1] = "RANGE_MAP";
    })(LogicalComplexType || (LogicalComplexType = {}));
    // Retrieve enum metadata with: proto3.getEnumType(LogicalComplexType)
    proto3.util.setEnumType(LogicalComplexType, "mlt.LogicalComplexType", [
        { no: 0, name: "BINARY" },
        { no: 1, name: "RANGE_MAP" },
    ]);
    /**
     * @generated from message mlt.TileSetMetadata
     */
    class TileSetMetadata extends Message {
        constructor(data) {
            super();
            /**
             * @generated from field: int32 version = 1;
             */
            this.version = 0;
            /**
             * @generated from field: repeated mlt.FeatureTableSchema featureTables = 2;
             */
            this.featureTables = [];
            /**
             * order left, bottom, right, top in WGS84
             *
             * @generated from field: repeated double bounds = 8;
             */
            this.bounds = [];
            /**
             * order longitude, latitude in WGS84
             *
             * @generated from field: repeated double center = 9;
             */
            this.center = [];
            proto3.util.initPartial(data, this);
        }
        static fromBinary(bytes, options) {
            return new TileSetMetadata().fromBinary(bytes, options);
        }
        static fromJson(jsonValue, options) {
            return new TileSetMetadata().fromJson(jsonValue, options);
        }
        static fromJsonString(jsonString, options) {
            return new TileSetMetadata().fromJsonString(jsonString, options);
        }
        static equals(a, b) {
            return proto3.util.equals(TileSetMetadata, a, b);
        }
    }
    TileSetMetadata.runtime = proto3;
    TileSetMetadata.typeName = "mlt.TileSetMetadata";
    TileSetMetadata.fields = proto3.util.newFieldList(() => [
        { no: 1, name: "version", kind: "scalar", T: 5 /* ScalarType.INT32 */ },
        { no: 2, name: "featureTables", kind: "message", T: FeatureTableSchema, repeated: true },
        { no: 3, name: "name", kind: "scalar", T: 9 /* ScalarType.STRING */, opt: true },
        { no: 4, name: "description", kind: "scalar", T: 9 /* ScalarType.STRING */, opt: true },
        { no: 5, name: "attribution", kind: "scalar", T: 9 /* ScalarType.STRING */, opt: true },
        { no: 6, name: "minZoom", kind: "scalar", T: 5 /* ScalarType.INT32 */, opt: true },
        { no: 7, name: "maxZoom", kind: "scalar", T: 5 /* ScalarType.INT32 */, opt: true },
        { no: 8, name: "bounds", kind: "scalar", T: 1 /* ScalarType.DOUBLE */, repeated: true },
        { no: 9, name: "center", kind: "scalar", T: 1 /* ScalarType.DOUBLE */, repeated: true },
    ]);
    /**
     * @generated from message mlt.FeatureTableSchema
     */
    class FeatureTableSchema extends Message {
        constructor(data) {
            super();
            /**
             * @generated from field: string name = 1;
             */
            this.name = "";
            /**
             * @generated from field: repeated mlt.Column columns = 2;
             */
            this.columns = [];
            proto3.util.initPartial(data, this);
        }
        static fromBinary(bytes, options) {
            return new FeatureTableSchema().fromBinary(bytes, options);
        }
        static fromJson(jsonValue, options) {
            return new FeatureTableSchema().fromJson(jsonValue, options);
        }
        static fromJsonString(jsonString, options) {
            return new FeatureTableSchema().fromJsonString(jsonString, options);
        }
        static equals(a, b) {
            return proto3.util.equals(FeatureTableSchema, a, b);
        }
    }
    FeatureTableSchema.runtime = proto3;
    FeatureTableSchema.typeName = "mlt.FeatureTableSchema";
    FeatureTableSchema.fields = proto3.util.newFieldList(() => [
        { no: 1, name: "name", kind: "scalar", T: 9 /* ScalarType.STRING */ },
        { no: 2, name: "columns", kind: "message", T: Column, repeated: true },
    ]);
    /**
     * Column are top-level types in the schema
     *
     * @generated from message mlt.Column
     */
    class Column extends Message {
        constructor(data) {
            super();
            /**
             * @generated from field: string name = 1;
             */
            this.name = "";
            /**
             * specifies if the values are optional in the column and a present stream should be used
             *
             * @generated from field: bool nullable = 2;
             */
            this.nullable = false;
            /**
             * @generated from field: mlt.ColumnScope columnScope = 3;
             */
            this.columnScope = ColumnScope.FEATURE;
            /**
             * @generated from oneof mlt.Column.type
             */
            this.type = { case: undefined };
            proto3.util.initPartial(data, this);
        }
        static fromBinary(bytes, options) {
            return new Column().fromBinary(bytes, options);
        }
        static fromJson(jsonValue, options) {
            return new Column().fromJson(jsonValue, options);
        }
        static fromJsonString(jsonString, options) {
            return new Column().fromJsonString(jsonString, options);
        }
        static equals(a, b) {
            return proto3.util.equals(Column, a, b);
        }
    }
    Column.runtime = proto3;
    Column.typeName = "mlt.Column";
    Column.fields = proto3.util.newFieldList(() => [
        { no: 1, name: "name", kind: "scalar", T: 9 /* ScalarType.STRING */ },
        { no: 2, name: "nullable", kind: "scalar", T: 8 /* ScalarType.BOOL */ },
        { no: 3, name: "columnScope", kind: "enum", T: proto3.getEnumType(ColumnScope) },
        { no: 4, name: "scalarType", kind: "message", T: ScalarColumn, oneof: "type" },
        { no: 5, name: "complexType", kind: "message", T: ComplexColumn, oneof: "type" },
    ]);
    /**
     * @generated from message mlt.ScalarColumn
     */
    class ScalarColumn extends Message {
        constructor(data) {
            super();
            /**
             * @generated from oneof mlt.ScalarColumn.type
             */
            this.type = { case: undefined };
            proto3.util.initPartial(data, this);
        }
        static fromBinary(bytes, options) {
            return new ScalarColumn().fromBinary(bytes, options);
        }
        static fromJson(jsonValue, options) {
            return new ScalarColumn().fromJson(jsonValue, options);
        }
        static fromJsonString(jsonString, options) {
            return new ScalarColumn().fromJsonString(jsonString, options);
        }
        static equals(a, b) {
            return proto3.util.equals(ScalarColumn, a, b);
        }
    }
    ScalarColumn.runtime = proto3;
    ScalarColumn.typeName = "mlt.ScalarColumn";
    ScalarColumn.fields = proto3.util.newFieldList(() => [
        { no: 4, name: "physicalType", kind: "enum", T: proto3.getEnumType(ScalarType), oneof: "type" },
        { no: 5, name: "logicalType", kind: "enum", T: proto3.getEnumType(LogicalScalarType), oneof: "type" },
    ]);
    /**
     * The type tree is flattened in to a list via a pre-order traversal
     * Represents a column if it is a root (top-level) type or a child of a nested type
     *
     * @generated from message mlt.ComplexColumn
     */
    class ComplexColumn extends Message {
        constructor(data) {
            super();
            /**
             * @generated from oneof mlt.ComplexColumn.type
             */
            this.type = { case: undefined };
            /**
             * The complex type Geometry and the logical type BINARY have no children since there layout is implicit known.
             * RangeMap has only one child specifying the type of the value since the key is always a vec2<double>.
             *
             * @generated from field: repeated mlt.Field children = 6;
             */
            this.children = [];
            proto3.util.initPartial(data, this);
        }
        static fromBinary(bytes, options) {
            return new ComplexColumn().fromBinary(bytes, options);
        }
        static fromJson(jsonValue, options) {
            return new ComplexColumn().fromJson(jsonValue, options);
        }
        static fromJsonString(jsonString, options) {
            return new ComplexColumn().fromJsonString(jsonString, options);
        }
        static equals(a, b) {
            return proto3.util.equals(ComplexColumn, a, b);
        }
    }
    ComplexColumn.runtime = proto3;
    ComplexColumn.typeName = "mlt.ComplexColumn";
    ComplexColumn.fields = proto3.util.newFieldList(() => [
        { no: 4, name: "physicalType", kind: "enum", T: proto3.getEnumType(ComplexType), oneof: "type" },
        { no: 5, name: "logicalType", kind: "enum", T: proto3.getEnumType(LogicalComplexType), oneof: "type" },
        { no: 6, name: "children", kind: "message", T: Field, repeated: true },
    ]);
    /**
     * Fields define nested or leaf types in the schema as part of a complex type definition
     *
     * @generated from message mlt.Field
     */
    class Field extends Message {
        constructor(data) {
            super();
            /**
             * @generated from oneof mlt.Field.type
             */
            this.type = { case: undefined };
            proto3.util.initPartial(data, this);
        }
        static fromBinary(bytes, options) {
            return new Field().fromBinary(bytes, options);
        }
        static fromJson(jsonValue, options) {
            return new Field().fromJson(jsonValue, options);
        }
        static fromJsonString(jsonString, options) {
            return new Field().fromJsonString(jsonString, options);
        }
        static equals(a, b) {
            return proto3.util.equals(Field, a, b);
        }
    }
    Field.runtime = proto3;
    Field.typeName = "mlt.Field";
    Field.fields = proto3.util.newFieldList(() => [
        { no: 1, name: "name", kind: "scalar", T: 9 /* ScalarType.STRING */, opt: true },
        { no: 2, name: "nullable", kind: "scalar", T: 8 /* ScalarType.BOOL */, opt: true },
        { no: 3, name: "scalarField", kind: "message", T: ScalarField, oneof: "type" },
        { no: 4, name: "complexField", kind: "message", T: ComplexField, oneof: "type" },
    ]);
    /**
     * @generated from message mlt.ScalarField
     */
    class ScalarField extends Message {
        constructor(data) {
            super();
            /**
             * @generated from oneof mlt.ScalarField.type
             */
            this.type = { case: undefined };
            proto3.util.initPartial(data, this);
        }
        static fromBinary(bytes, options) {
            return new ScalarField().fromBinary(bytes, options);
        }
        static fromJson(jsonValue, options) {
            return new ScalarField().fromJson(jsonValue, options);
        }
        static fromJsonString(jsonString, options) {
            return new ScalarField().fromJsonString(jsonString, options);
        }
        static equals(a, b) {
            return proto3.util.equals(ScalarField, a, b);
        }
    }
    ScalarField.runtime = proto3;
    ScalarField.typeName = "mlt.ScalarField";
    ScalarField.fields = proto3.util.newFieldList(() => [
        { no: 1, name: "physicalType", kind: "enum", T: proto3.getEnumType(ScalarType), oneof: "type" },
        { no: 2, name: "logicalType", kind: "enum", T: proto3.getEnumType(LogicalScalarType), oneof: "type" },
    ]);
    /**
     * @generated from message mlt.ComplexField
     */
    class ComplexField extends Message {
        constructor(data) {
            super();
            /**
             * @generated from oneof mlt.ComplexField.type
             */
            this.type = { case: undefined };
            /**
             * @generated from field: repeated mlt.Field children = 3;
             */
            this.children = [];
            proto3.util.initPartial(data, this);
        }
        static fromBinary(bytes, options) {
            return new ComplexField().fromBinary(bytes, options);
        }
        static fromJson(jsonValue, options) {
            return new ComplexField().fromJson(jsonValue, options);
        }
        static fromJsonString(jsonString, options) {
            return new ComplexField().fromJsonString(jsonString, options);
        }
        static equals(a, b) {
            return proto3.util.equals(ComplexField, a, b);
        }
    }
    ComplexField.runtime = proto3;
    ComplexField.typeName = "mlt.ComplexField";
    ComplexField.fields = proto3.util.newFieldList(() => [
        { no: 1, name: "physicalType", kind: "enum", T: proto3.getEnumType(ComplexType), oneof: "type" },
        { no: 2, name: "logicalType", kind: "enum", T: proto3.getEnumType(LogicalComplexType), oneof: "type" },
        { no: 3, name: "children", kind: "message", T: Field, repeated: true },
    ]);

    class PropertyDecoder {
        static decodePropertyColumn(data, offset, column, numStreams) {
            let presentStreamMetadata = null;
            // https://github.com/bufbuild/protobuf-es/blob/main/docs/runtime_api.md#accessing-oneof-groups
            const scalarColumn = column.type.case;
            if (scalarColumn !== undefined) {
                let presentStream = null;
                let numValues = 0;
                if (numStreams > 1) {
                    presentStreamMetadata = StreamMetadataDecoder.decode(data, offset);
                    numValues = presentStreamMetadata.numValues();
                    presentStream = DecodingUtils.decodeBooleanRle(data, presentStreamMetadata.numValues(), offset);
                }
                const physicalType = column.type.value.type.value;
                switch (physicalType) {
                    case ScalarType.BOOLEAN: {
                        const dataStreamMetadata = StreamMetadataDecoder.decode(data, offset);
                        const dataStream = DecodingUtils.decodeBooleanRle(data, dataStreamMetadata.numValues(), offset);
                        const booleanValues = new Array(presentStreamMetadata.numValues());
                        let counter = 0;
                        for (let i = 0; i < presentStreamMetadata.numValues(); i++) {
                            const value = presentStream.get(i) ? dataStream.get(counter++) : null;
                            booleanValues[i] = value !== null ? Boolean(value) : null;
                        }
                        return booleanValues;
                    }
                    case ScalarType.UINT_32: {
                        const dataStreamMetadata = StreamMetadataDecoder.decode(data, offset);
                        const dataStream = IntegerDecoder.decodeIntStream(data, offset, dataStreamMetadata, false);
                        const values = new Array(presentStreamMetadata.numValues());
                        let counter = 0;
                        for (let i = 0; i < presentStreamMetadata.numValues(); i++) {
                            const value = presentStream.get(i) ? dataStream[counter++] : null;
                            values[i] = value;
                        }
                        return values;
                    }
                    case ScalarType.INT_32: {
                        const dataStreamMetadata = StreamMetadataDecoder.decode(data, offset);
                        const dataStream = IntegerDecoder.decodeIntStream(data, offset, dataStreamMetadata, true);
                        const values = new Array(presentStreamMetadata.numValues());
                        let counter = 0;
                        for (let i = 0; i < presentStreamMetadata.numValues(); i++) {
                            const value = presentStream.get(i) ? dataStream[counter++] : null;
                            values[i] = value;
                        }
                        return values;
                    }
                    case ScalarType.DOUBLE: {
                        const dataStreamMetadata = StreamMetadataDecoder.decode(data, offset);
                        const dataStream = DoubleDecoder.decodeDoubleStream(data, offset, dataStreamMetadata);
                        const values = new Array(presentStreamMetadata.numValues());
                        let counter = 0;
                        for (let i = 0; i < presentStreamMetadata.numValues(); i++) {
                            const value = presentStream.get(i) ? dataStream[counter++] : null;
                            values[i] = value;
                        }
                        return values;
                    }
                    case ScalarType.FLOAT: {
                        const dataStreamMetadata = StreamMetadataDecoder.decode(data, offset);
                        const dataStream = FloatDecoder.decodeFloatStream(data, offset, dataStreamMetadata);
                        const values = new Array(presentStreamMetadata.numValues());
                        let counter = 0;
                        for (let i = 0; i < presentStreamMetadata.numValues(); i++) {
                            const value = presentStream.get(i) ? dataStream[counter++] : null;
                            values[i] = value;
                        }
                        return values;
                    }
                    case ScalarType.UINT_64: {
                        const dataStreamMetadata = StreamMetadataDecoder.decode(data, offset);
                        const dataStream = IntegerDecoder.decodeLongStream(data, offset, dataStreamMetadata, false);
                        const values = new Array(presentStreamMetadata.numValues());
                        let counter = 0;
                        for (let i = 0; i < presentStreamMetadata.numValues(); i++) {
                            const value = presentStream.get(i) ? dataStream[counter++] : null;
                            values[i] = value;
                        }
                        return values;
                    }
                    case ScalarType.INT_64: {
                        const dataStreamMetadata = StreamMetadataDecoder.decode(data, offset);
                        const dataStream = IntegerDecoder.decodeLongStream(data, offset, dataStreamMetadata, true);
                        const values = new Array(presentStreamMetadata.numValues());
                        let counter = 0;
                        for (let i = 0; i < presentStreamMetadata.numValues(); i++) {
                            const value = presentStream.get(i) ? dataStream[counter++] : null;
                            values[i] = value;
                        }
                        return values;
                    }
                    case ScalarType.STRING: {
                        return StringDecoder.decode(data, offset, numStreams - 1, presentStream, numValues);
                    }
                    default:
                        throw new Error("The specified data type for the field is currently not supported " + physicalType);
                }
            }
            if (numStreams === 1) {
                throw new Error("Present stream currently not supported for Structs.");
            }
            else {
                // TODO
                throw new Error("Strings are not supported yet for Structs.");
                //const result = StringDecoder.decodeSharedDictionary(data, offset, column);
                //return result.getRight();
            }
        }
    }

    class MltDecoder {
        static decodeMlTile(tile, tileMetadata) {
            const offset = new IntWrapper(0);
            const mltLayers = [];
            while (offset.get() < tile.length) {
                let ids = [];
                let geometries = [];
                const properties = {};
                offset.increment();
                const infos = DecodingUtils.decodeVarint(tile, offset, 4);
                const version = tile[offset.get()];
                const extent = infos[1];
                const featureTableId = infos[0];
                const numFeatures = infos[3];
                const metadata = tileMetadata.featureTables[featureTableId];
                if (!metadata) {
                    console.log(`could not find metadata for feature table id: ${featureTableId}`);
                    return;
                }
                for (const columnMetadata of metadata.columns) {
                    const columnName = columnMetadata.name;
                    const numStreams = DecodingUtils.decodeVarint(tile, offset, 1)[0];
                    if (columnName === "id") {
                        if (numStreams === 2) {
                            const presentStreamMetadata = StreamMetadataDecoder.decode(tile, offset);
                            // TODO: the return value of this function is not used, so advance offset without decoding?
                            DecodingUtils.decodeBooleanRle(tile, presentStreamMetadata.numValues(), offset);
                        }
                        else {
                            throw new Error("Unsupported number of streams for ID column: " + numStreams);
                        }
                        const idDataStreamMetadata = StreamMetadataDecoder.decode(tile, offset);
                        const physicalType = columnMetadata.type.value.type.value;
                        if (physicalType === ScalarType.UINT_32) {
                            ids = IntegerDecoder.decodeIntStream(tile, offset, idDataStreamMetadata, false);
                        }
                        else if (physicalType === ScalarType.UINT_64) {
                            ids = IntegerDecoder.decodeLongStream(tile, offset, idDataStreamMetadata, false);
                        }
                        else {
                            throw new Error("Unsupported ID column type: " + physicalType);
                        }
                    }
                    else if (columnName === "geometry") {
                        const geometryColumn = GeometryDecoder.decodeGeometryColumn(tile, numStreams, offset);
                        geometries = GeometryDecoder.decodeGeometry(geometryColumn);
                    }
                    else {
                        const propertyColumn = PropertyDecoder.decodePropertyColumn(tile, offset, columnMetadata, numStreams);
                        if (propertyColumn instanceof Map) {
                            throw new Error("Nested properties are not implemented yet");
                        }
                        else {
                            properties[columnName] = propertyColumn;
                        }
                    }
                }
                const layer = MltDecoder.convertToLayer(ids, extent, version, geometries, properties, metadata, numFeatures);
                mltLayers.push(layer);
            }
            return new MapLibreTile(mltLayers);
        }
        static convertToLayer(ids, extent, version, geometries, properties, metadata, numFeatures) {
            const features = new Array(numFeatures);
            const vals = Object.entries(properties);
            for (let j = 0; j < numFeatures; j++) {
                /* eslint-disable @typescript-eslint/no-explicit-any */
                const p = {};
                for (const [key, value] of vals) {
                    p[key] = value ? value[j] : null;
                }
                features[j] = new Feature(ids[j], extent, geometries[j], p);
            }
            return new Layer(metadata.name, version, features);
        }
    }

    module.exports.VectorTile = require('./lib/vectortile.js');
    module.exports.VectorTileFeature = require('./lib/vectortilefeature.js');
    module.exports.VectorTileLayer = require('./lib/vectortilelayer.js');

    var VectorTile = /*#__PURE__*/Object.freeze({
        __proto__: null
    });

    module.exports = Pbf;

    var ieee754 = require('ieee754');

    function Pbf(buf) {
        this.buf = ArrayBuffer.isView && ArrayBuffer.isView(buf) ? buf : new Uint8Array(buf || 0);
        this.pos = 0;
        this.type = 0;
        this.length = this.buf.length;
    }

    Pbf.Varint  = 0; // varint: int32, int64, uint32, uint64, sint32, sint64, bool, enum
    Pbf.Fixed64 = 1; // 64-bit: double, fixed64, sfixed64
    Pbf.Bytes   = 2; // length-delimited: string, bytes, embedded messages, packed repeated fields
    Pbf.Fixed32 = 5; // 32-bit: float, fixed32, sfixed32

    var SHIFT_LEFT_32 = (1 << 16) * (1 << 16),
        SHIFT_RIGHT_32 = 1 / SHIFT_LEFT_32;

    // Threshold chosen based on both benchmarking and knowledge about browser string
    // data structures (which currently switch structure types at 12 bytes or more)
    var TEXT_DECODER_MIN_LENGTH = 12;
    var utf8TextDecoder = typeof TextDecoder === 'undefined' ? null : new TextDecoder('utf8');

    Pbf.prototype = {

        destroy: function() {
            this.buf = null;
        },

        // === READING =================================================================

        readFields: function(readField, result, end) {
            end = end || this.length;

            while (this.pos < end) {
                var val = this.readVarint(),
                    tag = val >> 3,
                    startPos = this.pos;

                this.type = val & 0x7;
                readField(tag, result, this);

                if (this.pos === startPos) this.skip(val);
            }
            return result;
        },

        readMessage: function(readField, result) {
            return this.readFields(readField, result, this.readVarint() + this.pos);
        },

        readFixed32: function() {
            var val = readUInt32(this.buf, this.pos);
            this.pos += 4;
            return val;
        },

        readSFixed32: function() {
            var val = readInt32(this.buf, this.pos);
            this.pos += 4;
            return val;
        },

        // 64-bit int handling is based on github.com/dpw/node-buffer-more-ints (MIT-licensed)

        readFixed64: function() {
            var val = readUInt32(this.buf, this.pos) + readUInt32(this.buf, this.pos + 4) * SHIFT_LEFT_32;
            this.pos += 8;
            return val;
        },

        readSFixed64: function() {
            var val = readUInt32(this.buf, this.pos) + readInt32(this.buf, this.pos + 4) * SHIFT_LEFT_32;
            this.pos += 8;
            return val;
        },

        readFloat: function() {
            var val = ieee754.read(this.buf, this.pos, true, 23, 4);
            this.pos += 4;
            return val;
        },

        readDouble: function() {
            var val = ieee754.read(this.buf, this.pos, true, 52, 8);
            this.pos += 8;
            return val;
        },

        readVarint: function(isSigned) {
            var buf = this.buf,
                val, b;

            b = buf[this.pos++]; val  =  b & 0x7f;        if (b < 0x80) return val;
            b = buf[this.pos++]; val |= (b & 0x7f) << 7;  if (b < 0x80) return val;
            b = buf[this.pos++]; val |= (b & 0x7f) << 14; if (b < 0x80) return val;
            b = buf[this.pos++]; val |= (b & 0x7f) << 21; if (b < 0x80) return val;
            b = buf[this.pos];   val |= (b & 0x0f) << 28;

            return readVarintRemainder(val, isSigned, this);
        },

        readVarint64: function() { // for compatibility with v2.0.1
            return this.readVarint(true);
        },

        readSVarint: function() {
            var num = this.readVarint();
            return num % 2 === 1 ? (num + 1) / -2 : num / 2; // zigzag encoding
        },

        readBoolean: function() {
            return Boolean(this.readVarint());
        },

        readString: function() {
            var end = this.readVarint() + this.pos;
            var pos = this.pos;
            this.pos = end;

            if (end - pos >= TEXT_DECODER_MIN_LENGTH && utf8TextDecoder) {
                // longer strings are fast with the built-in browser TextDecoder API
                return readUtf8TextDecoder(this.buf, pos, end);
            }
            // short strings are fast with our custom implementation
            return readUtf8(this.buf, pos, end);
        },

        readBytes: function() {
            var end = this.readVarint() + this.pos,
                buffer = this.buf.subarray(this.pos, end);
            this.pos = end;
            return buffer;
        },

        // verbose for performance reasons; doesn't affect gzipped size

        readPackedVarint: function(arr, isSigned) {
            if (this.type !== Pbf.Bytes) return arr.push(this.readVarint(isSigned));
            var end = readPackedEnd(this);
            arr = arr || [];
            while (this.pos < end) arr.push(this.readVarint(isSigned));
            return arr;
        },
        readPackedSVarint: function(arr) {
            if (this.type !== Pbf.Bytes) return arr.push(this.readSVarint());
            var end = readPackedEnd(this);
            arr = arr || [];
            while (this.pos < end) arr.push(this.readSVarint());
            return arr;
        },
        readPackedBoolean: function(arr) {
            if (this.type !== Pbf.Bytes) return arr.push(this.readBoolean());
            var end = readPackedEnd(this);
            arr = arr || [];
            while (this.pos < end) arr.push(this.readBoolean());
            return arr;
        },
        readPackedFloat: function(arr) {
            if (this.type !== Pbf.Bytes) return arr.push(this.readFloat());
            var end = readPackedEnd(this);
            arr = arr || [];
            while (this.pos < end) arr.push(this.readFloat());
            return arr;
        },
        readPackedDouble: function(arr) {
            if (this.type !== Pbf.Bytes) return arr.push(this.readDouble());
            var end = readPackedEnd(this);
            arr = arr || [];
            while (this.pos < end) arr.push(this.readDouble());
            return arr;
        },
        readPackedFixed32: function(arr) {
            if (this.type !== Pbf.Bytes) return arr.push(this.readFixed32());
            var end = readPackedEnd(this);
            arr = arr || [];
            while (this.pos < end) arr.push(this.readFixed32());
            return arr;
        },
        readPackedSFixed32: function(arr) {
            if (this.type !== Pbf.Bytes) return arr.push(this.readSFixed32());
            var end = readPackedEnd(this);
            arr = arr || [];
            while (this.pos < end) arr.push(this.readSFixed32());
            return arr;
        },
        readPackedFixed64: function(arr) {
            if (this.type !== Pbf.Bytes) return arr.push(this.readFixed64());
            var end = readPackedEnd(this);
            arr = arr || [];
            while (this.pos < end) arr.push(this.readFixed64());
            return arr;
        },
        readPackedSFixed64: function(arr) {
            if (this.type !== Pbf.Bytes) return arr.push(this.readSFixed64());
            var end = readPackedEnd(this);
            arr = arr || [];
            while (this.pos < end) arr.push(this.readSFixed64());
            return arr;
        },

        skip: function(val) {
            var type = val & 0x7;
            if (type === Pbf.Varint) while (this.buf[this.pos++] > 0x7f) {}
            else if (type === Pbf.Bytes) this.pos = this.readVarint() + this.pos;
            else if (type === Pbf.Fixed32) this.pos += 4;
            else if (type === Pbf.Fixed64) this.pos += 8;
            else throw new Error('Unimplemented type: ' + type);
        },

        // === WRITING =================================================================

        writeTag: function(tag, type) {
            this.writeVarint((tag << 3) | type);
        },

        realloc: function(min) {
            var length = this.length || 16;

            while (length < this.pos + min) length *= 2;

            if (length !== this.length) {
                var buf = new Uint8Array(length);
                buf.set(this.buf);
                this.buf = buf;
                this.length = length;
            }
        },

        finish: function() {
            this.length = this.pos;
            this.pos = 0;
            return this.buf.subarray(0, this.length);
        },

        writeFixed32: function(val) {
            this.realloc(4);
            writeInt32(this.buf, val, this.pos);
            this.pos += 4;
        },

        writeSFixed32: function(val) {
            this.realloc(4);
            writeInt32(this.buf, val, this.pos);
            this.pos += 4;
        },

        writeFixed64: function(val) {
            this.realloc(8);
            writeInt32(this.buf, val & -1, this.pos);
            writeInt32(this.buf, Math.floor(val * SHIFT_RIGHT_32), this.pos + 4);
            this.pos += 8;
        },

        writeSFixed64: function(val) {
            this.realloc(8);
            writeInt32(this.buf, val & -1, this.pos);
            writeInt32(this.buf, Math.floor(val * SHIFT_RIGHT_32), this.pos + 4);
            this.pos += 8;
        },

        writeVarint: function(val) {
            val = +val || 0;

            if (val > 0xfffffff || val < 0) {
                writeBigVarint(val, this);
                return;
            }

            this.realloc(4);

            this.buf[this.pos++] =           val & 0x7f  | (val > 0x7f ? 0x80 : 0); if (val <= 0x7f) return;
            this.buf[this.pos++] = ((val >>>= 7) & 0x7f) | (val > 0x7f ? 0x80 : 0); if (val <= 0x7f) return;
            this.buf[this.pos++] = ((val >>>= 7) & 0x7f) | (val > 0x7f ? 0x80 : 0); if (val <= 0x7f) return;
            this.buf[this.pos++] =   (val >>> 7) & 0x7f;
        },

        writeSVarint: function(val) {
            this.writeVarint(val < 0 ? -val * 2 - 1 : val * 2);
        },

        writeBoolean: function(val) {
            this.writeVarint(Boolean(val));
        },

        writeString: function(str) {
            str = String(str);
            this.realloc(str.length * 4);

            this.pos++; // reserve 1 byte for short string length

            var startPos = this.pos;
            // write the string directly to the buffer and see how much was written
            this.pos = writeUtf8(this.buf, str, this.pos);
            var len = this.pos - startPos;

            if (len >= 0x80) makeRoomForExtraLength(startPos, len, this);

            // finally, write the message length in the reserved place and restore the position
            this.pos = startPos - 1;
            this.writeVarint(len);
            this.pos += len;
        },

        writeFloat: function(val) {
            this.realloc(4);
            ieee754.write(this.buf, val, this.pos, true, 23, 4);
            this.pos += 4;
        },

        writeDouble: function(val) {
            this.realloc(8);
            ieee754.write(this.buf, val, this.pos, true, 52, 8);
            this.pos += 8;
        },

        writeBytes: function(buffer) {
            var len = buffer.length;
            this.writeVarint(len);
            this.realloc(len);
            for (var i = 0; i < len; i++) this.buf[this.pos++] = buffer[i];
        },

        writeRawMessage: function(fn, obj) {
            this.pos++; // reserve 1 byte for short message length

            // write the message directly to the buffer and see how much was written
            var startPos = this.pos;
            fn(obj, this);
            var len = this.pos - startPos;

            if (len >= 0x80) makeRoomForExtraLength(startPos, len, this);

            // finally, write the message length in the reserved place and restore the position
            this.pos = startPos - 1;
            this.writeVarint(len);
            this.pos += len;
        },

        writeMessage: function(tag, fn, obj) {
            this.writeTag(tag, Pbf.Bytes);
            this.writeRawMessage(fn, obj);
        },

        writePackedVarint:   function(tag, arr) { if (arr.length) this.writeMessage(tag, writePackedVarint, arr);   },
        writePackedSVarint:  function(tag, arr) { if (arr.length) this.writeMessage(tag, writePackedSVarint, arr);  },
        writePackedBoolean:  function(tag, arr) { if (arr.length) this.writeMessage(tag, writePackedBoolean, arr);  },
        writePackedFloat:    function(tag, arr) { if (arr.length) this.writeMessage(tag, writePackedFloat, arr);    },
        writePackedDouble:   function(tag, arr) { if (arr.length) this.writeMessage(tag, writePackedDouble, arr);   },
        writePackedFixed32:  function(tag, arr) { if (arr.length) this.writeMessage(tag, writePackedFixed32, arr);  },
        writePackedSFixed32: function(tag, arr) { if (arr.length) this.writeMessage(tag, writePackedSFixed32, arr); },
        writePackedFixed64:  function(tag, arr) { if (arr.length) this.writeMessage(tag, writePackedFixed64, arr);  },
        writePackedSFixed64: function(tag, arr) { if (arr.length) this.writeMessage(tag, writePackedSFixed64, arr); },

        writeBytesField: function(tag, buffer) {
            this.writeTag(tag, Pbf.Bytes);
            this.writeBytes(buffer);
        },
        writeFixed32Field: function(tag, val) {
            this.writeTag(tag, Pbf.Fixed32);
            this.writeFixed32(val);
        },
        writeSFixed32Field: function(tag, val) {
            this.writeTag(tag, Pbf.Fixed32);
            this.writeSFixed32(val);
        },
        writeFixed64Field: function(tag, val) {
            this.writeTag(tag, Pbf.Fixed64);
            this.writeFixed64(val);
        },
        writeSFixed64Field: function(tag, val) {
            this.writeTag(tag, Pbf.Fixed64);
            this.writeSFixed64(val);
        },
        writeVarintField: function(tag, val) {
            this.writeTag(tag, Pbf.Varint);
            this.writeVarint(val);
        },
        writeSVarintField: function(tag, val) {
            this.writeTag(tag, Pbf.Varint);
            this.writeSVarint(val);
        },
        writeStringField: function(tag, str) {
            this.writeTag(tag, Pbf.Bytes);
            this.writeString(str);
        },
        writeFloatField: function(tag, val) {
            this.writeTag(tag, Pbf.Fixed32);
            this.writeFloat(val);
        },
        writeDoubleField: function(tag, val) {
            this.writeTag(tag, Pbf.Fixed64);
            this.writeDouble(val);
        },
        writeBooleanField: function(tag, val) {
            this.writeVarintField(tag, Boolean(val));
        }
    };

    function readVarintRemainder(l, s, p) {
        var buf = p.buf,
            h, b;

        b = buf[p.pos++]; h  = (b & 0x70) >> 4;  if (b < 0x80) return toNum(l, h, s);
        b = buf[p.pos++]; h |= (b & 0x7f) << 3;  if (b < 0x80) return toNum(l, h, s);
        b = buf[p.pos++]; h |= (b & 0x7f) << 10; if (b < 0x80) return toNum(l, h, s);
        b = buf[p.pos++]; h |= (b & 0x7f) << 17; if (b < 0x80) return toNum(l, h, s);
        b = buf[p.pos++]; h |= (b & 0x7f) << 24; if (b < 0x80) return toNum(l, h, s);
        b = buf[p.pos++]; h |= (b & 0x01) << 31; if (b < 0x80) return toNum(l, h, s);

        throw new Error('Expected varint not more than 10 bytes');
    }

    function readPackedEnd(pbf) {
        return pbf.type === Pbf.Bytes ?
            pbf.readVarint() + pbf.pos : pbf.pos + 1;
    }

    function toNum(low, high, isSigned) {
        if (isSigned) {
            return high * 0x100000000 + (low >>> 0);
        }

        return ((high >>> 0) * 0x100000000) + (low >>> 0);
    }

    function writeBigVarint(val, pbf) {
        var low, high;

        if (val >= 0) {
            low  = (val % 0x100000000) | 0;
            high = (val / 0x100000000) | 0;
        } else {
            low  = ~(-val % 0x100000000);
            high = ~(-val / 0x100000000);

            if (low ^ 0xffffffff) {
                low = (low + 1) | 0;
            } else {
                low = 0;
                high = (high + 1) | 0;
            }
        }

        if (val >= 0x10000000000000000 || val < -0x10000000000000000) {
            throw new Error('Given varint doesn\'t fit into 10 bytes');
        }

        pbf.realloc(10);

        writeBigVarintLow(low, high, pbf);
        writeBigVarintHigh(high, pbf);
    }

    function writeBigVarintLow(low, high, pbf) {
        pbf.buf[pbf.pos++] = low & 0x7f | 0x80; low >>>= 7;
        pbf.buf[pbf.pos++] = low & 0x7f | 0x80; low >>>= 7;
        pbf.buf[pbf.pos++] = low & 0x7f | 0x80; low >>>= 7;
        pbf.buf[pbf.pos++] = low & 0x7f | 0x80; low >>>= 7;
        pbf.buf[pbf.pos]   = low & 0x7f;
    }

    function writeBigVarintHigh(high, pbf) {
        var lsb = (high & 0x07) << 4;

        pbf.buf[pbf.pos++] |= lsb         | ((high >>>= 3) ? 0x80 : 0); if (!high) return;
        pbf.buf[pbf.pos++]  = high & 0x7f | ((high >>>= 7) ? 0x80 : 0); if (!high) return;
        pbf.buf[pbf.pos++]  = high & 0x7f | ((high >>>= 7) ? 0x80 : 0); if (!high) return;
        pbf.buf[pbf.pos++]  = high & 0x7f | ((high >>>= 7) ? 0x80 : 0); if (!high) return;
        pbf.buf[pbf.pos++]  = high & 0x7f | ((high >>>= 7) ? 0x80 : 0); if (!high) return;
        pbf.buf[pbf.pos++]  = high & 0x7f;
    }

    function makeRoomForExtraLength(startPos, len, pbf) {
        var extraLen =
            len <= 0x3fff ? 1 :
            len <= 0x1fffff ? 2 :
            len <= 0xfffffff ? 3 : Math.floor(Math.log(len) / (Math.LN2 * 7));

        // if 1 byte isn't enough for encoding message length, shift the data to the right
        pbf.realloc(extraLen);
        for (var i = pbf.pos - 1; i >= startPos; i--) pbf.buf[i + extraLen] = pbf.buf[i];
    }

    function writePackedVarint(arr, pbf)   { for (var i = 0; i < arr.length; i++) pbf.writeVarint(arr[i]);   }
    function writePackedSVarint(arr, pbf)  { for (var i = 0; i < arr.length; i++) pbf.writeSVarint(arr[i]);  }
    function writePackedFloat(arr, pbf)    { for (var i = 0; i < arr.length; i++) pbf.writeFloat(arr[i]);    }
    function writePackedDouble(arr, pbf)   { for (var i = 0; i < arr.length; i++) pbf.writeDouble(arr[i]);   }
    function writePackedBoolean(arr, pbf)  { for (var i = 0; i < arr.length; i++) pbf.writeBoolean(arr[i]);  }
    function writePackedFixed32(arr, pbf)  { for (var i = 0; i < arr.length; i++) pbf.writeFixed32(arr[i]);  }
    function writePackedSFixed32(arr, pbf) { for (var i = 0; i < arr.length; i++) pbf.writeSFixed32(arr[i]); }
    function writePackedFixed64(arr, pbf)  { for (var i = 0; i < arr.length; i++) pbf.writeFixed64(arr[i]);  }
    function writePackedSFixed64(arr, pbf) { for (var i = 0; i < arr.length; i++) pbf.writeSFixed64(arr[i]); }

    // Buffer code below from https://github.com/feross/buffer, MIT-licensed

    function readUInt32(buf, pos) {
        return ((buf[pos]) |
            (buf[pos + 1] << 8) |
            (buf[pos + 2] << 16)) +
            (buf[pos + 3] * 0x1000000);
    }

    function writeInt32(buf, val, pos) {
        buf[pos] = val;
        buf[pos + 1] = (val >>> 8);
        buf[pos + 2] = (val >>> 16);
        buf[pos + 3] = (val >>> 24);
    }

    function readInt32(buf, pos) {
        return ((buf[pos]) |
            (buf[pos + 1] << 8) |
            (buf[pos + 2] << 16)) +
            (buf[pos + 3] << 24);
    }

    function readUtf8(buf, pos, end) {
        var str = '';
        var i = pos;

        while (i < end) {
            var b0 = buf[i];
            var c = null; // codepoint
            var bytesPerSequence =
                b0 > 0xEF ? 4 :
                b0 > 0xDF ? 3 :
                b0 > 0xBF ? 2 : 1;

            if (i + bytesPerSequence > end) break;

            var b1, b2, b3;

            if (bytesPerSequence === 1) {
                if (b0 < 0x80) {
                    c = b0;
                }
            } else if (bytesPerSequence === 2) {
                b1 = buf[i + 1];
                if ((b1 & 0xC0) === 0x80) {
                    c = (b0 & 0x1F) << 0x6 | (b1 & 0x3F);
                    if (c <= 0x7F) {
                        c = null;
                    }
                }
            } else if (bytesPerSequence === 3) {
                b1 = buf[i + 1];
                b2 = buf[i + 2];
                if ((b1 & 0xC0) === 0x80 && (b2 & 0xC0) === 0x80) {
                    c = (b0 & 0xF) << 0xC | (b1 & 0x3F) << 0x6 | (b2 & 0x3F);
                    if (c <= 0x7FF || (c >= 0xD800 && c <= 0xDFFF)) {
                        c = null;
                    }
                }
            } else if (bytesPerSequence === 4) {
                b1 = buf[i + 1];
                b2 = buf[i + 2];
                b3 = buf[i + 3];
                if ((b1 & 0xC0) === 0x80 && (b2 & 0xC0) === 0x80 && (b3 & 0xC0) === 0x80) {
                    c = (b0 & 0xF) << 0x12 | (b1 & 0x3F) << 0xC | (b2 & 0x3F) << 0x6 | (b3 & 0x3F);
                    if (c <= 0xFFFF || c >= 0x110000) {
                        c = null;
                    }
                }
            }

            if (c === null) {
                c = 0xFFFD;
                bytesPerSequence = 1;

            } else if (c > 0xFFFF) {
                c -= 0x10000;
                str += String.fromCharCode(c >>> 10 & 0x3FF | 0xD800);
                c = 0xDC00 | c & 0x3FF;
            }

            str += String.fromCharCode(c);
            i += bytesPerSequence;
        }

        return str;
    }

    function readUtf8TextDecoder(buf, pos, end) {
        return utf8TextDecoder.decode(buf.subarray(pos, end));
    }

    function writeUtf8(buf, str, pos) {
        for (var i = 0, c, lead; i < str.length; i++) {
            c = str.charCodeAt(i); // code point

            if (c > 0xD7FF && c < 0xE000) {
                if (lead) {
                    if (c < 0xDC00) {
                        buf[pos++] = 0xEF;
                        buf[pos++] = 0xBF;
                        buf[pos++] = 0xBD;
                        lead = c;
                        continue;
                    } else {
                        c = lead - 0xD800 << 10 | c - 0xDC00 | 0x10000;
                        lead = null;
                    }
                } else {
                    if (c > 0xDBFF || (i + 1 === str.length)) {
                        buf[pos++] = 0xEF;
                        buf[pos++] = 0xBF;
                        buf[pos++] = 0xBD;
                    } else {
                        lead = c;
                    }
                    continue;
                }
            } else if (lead) {
                buf[pos++] = 0xEF;
                buf[pos++] = 0xBF;
                buf[pos++] = 0xBD;
                lead = null;
            }

            if (c < 0x80) {
                buf[pos++] = c;
            } else {
                if (c < 0x800) {
                    buf[pos++] = c >> 0x6 | 0xC0;
                } else {
                    if (c < 0x10000) {
                        buf[pos++] = c >> 0xC | 0xE0;
                    } else {
                        buf[pos++] = c >> 0x12 | 0xF0;
                        buf[pos++] = c >> 0xC & 0x3F | 0x80;
                    }
                    buf[pos++] = c >> 0x6 & 0x3F | 0x80;
                }
                buf[pos++] = c & 0x3F | 0x80;
            }
        }
        return pos;
    }

    var Protobuf = /*#__PURE__*/Object.freeze({
        __proto__: null
    });

    (function() {

      /** Used as a safe reference for `undefined` in pre ES5 environments. */
      var undefined$1;

      /** Used to determine if values are of the language type Object. */
      var objectTypes = {
        'function': true,
        'object': true
      };

      /** Used as a reference to the global object. */
      var root = (objectTypes[typeof window] && window) || this;

      /** Detect free variable `define`. */
      var freeDefine = typeof define == 'function' && typeof define.amd == 'object' && define.amd && define;

      /** Detect free variable `exports`. */
      var freeExports = objectTypes[typeof exports] && exports && !exports.nodeType && exports;

      /** Detect free variable `module`. */
      var freeModule = objectTypes[typeof module] && module && !module.nodeType && module;

      /** Detect free variable `global` from Node.js or Browserified code and use it as `root`. */
      var freeGlobal = freeExports && freeModule && typeof global$1 == 'object' && global$1;
      if (freeGlobal && (freeGlobal.global === freeGlobal || freeGlobal.window === freeGlobal || freeGlobal.self === freeGlobal)) {
        root = freeGlobal;
      }

      /** Detect free variable `require`. */
      var freeRequire = typeof require == 'function' && require;

      /** Used to assign each benchmark an incremented id. */
      var counter = 0;

      /** Detect the popular CommonJS extension `module.exports`. */
      var moduleExports = freeModule && freeModule.exports === freeExports && freeExports;

      /** Used to detect primitive types. */
      var rePrimitive = /^(?:boolean|number|string|undefined)$/;

      /** Used to make every compiled test unique. */
      var uidCounter = 0;

      /** Used to assign default `context` object properties. */
      var contextProps = [
        'Array', 'Date', 'Function', 'Math', 'Object', 'RegExp', 'String', '_',
        'clearTimeout', 'chrome', 'chromium', 'document', 'navigator', 'phantom',
        'platform', 'process', 'runtime', 'setTimeout'
      ];

      /** Used to avoid hz of Infinity. */
      var divisors = {
        '1': 4096,
        '2': 512,
        '3': 64,
        '4': 8,
        '5': 0
      };

      /**
       * T-Distribution two-tailed critical values for 95% confidence.
       * For more info see http://www.itl.nist.gov/div898/handbook/eda/section3/eda3672.htm.
       */
      var tTable = {
        '1':  12.706, '2':  4.303, '3':  3.182, '4':  2.776, '5':  2.571, '6':  2.447,
        '7':  2.365,  '8':  2.306, '9':  2.262, '10': 2.228, '11': 2.201, '12': 2.179,
        '13': 2.16,   '14': 2.145, '15': 2.131, '16': 2.12,  '17': 2.11,  '18': 2.101,
        '19': 2.093,  '20': 2.086, '21': 2.08,  '22': 2.074, '23': 2.069, '24': 2.064,
        '25': 2.06,   '26': 2.056, '27': 2.052, '28': 2.048, '29': 2.045, '30': 2.042,
        'infinity': 1.96
      };

      /**
       * Critical Mann-Whitney U-values for 95% confidence.
       * For more info see http://www.saburchill.com/IBbiology/stats/003.html.
       */
      var uTable = {
        '5':  [0, 1, 2],
        '6':  [1, 2, 3, 5],
        '7':  [1, 3, 5, 6, 8],
        '8':  [2, 4, 6, 8, 10, 13],
        '9':  [2, 4, 7, 10, 12, 15, 17],
        '10': [3, 5, 8, 11, 14, 17, 20, 23],
        '11': [3, 6, 9, 13, 16, 19, 23, 26, 30],
        '12': [4, 7, 11, 14, 18, 22, 26, 29, 33, 37],
        '13': [4, 8, 12, 16, 20, 24, 28, 33, 37, 41, 45],
        '14': [5, 9, 13, 17, 22, 26, 31, 36, 40, 45, 50, 55],
        '15': [5, 10, 14, 19, 24, 29, 34, 39, 44, 49, 54, 59, 64],
        '16': [6, 11, 15, 21, 26, 31, 37, 42, 47, 53, 59, 64, 70, 75],
        '17': [6, 11, 17, 22, 28, 34, 39, 45, 51, 57, 63, 67, 75, 81, 87],
        '18': [7, 12, 18, 24, 30, 36, 42, 48, 55, 61, 67, 74, 80, 86, 93, 99],
        '19': [7, 13, 19, 25, 32, 38, 45, 52, 58, 65, 72, 78, 85, 92, 99, 106, 113],
        '20': [8, 14, 20, 27, 34, 41, 48, 55, 62, 69, 76, 83, 90, 98, 105, 112, 119, 127],
        '21': [8, 15, 22, 29, 36, 43, 50, 58, 65, 73, 80, 88, 96, 103, 111, 119, 126, 134, 142],
        '22': [9, 16, 23, 30, 38, 45, 53, 61, 69, 77, 85, 93, 101, 109, 117, 125, 133, 141, 150, 158],
        '23': [9, 17, 24, 32, 40, 48, 56, 64, 73, 81, 89, 98, 106, 115, 123, 132, 140, 149, 157, 166, 175],
        '24': [10, 17, 25, 33, 42, 50, 59, 67, 76, 85, 94, 102, 111, 120, 129, 138, 147, 156, 165, 174, 183, 192],
        '25': [10, 18, 27, 35, 44, 53, 62, 71, 80, 89, 98, 107, 117, 126, 135, 145, 154, 163, 173, 182, 192, 201, 211],
        '26': [11, 19, 28, 37, 46, 55, 64, 74, 83, 93, 102, 112, 122, 132, 141, 151, 161, 171, 181, 191, 200, 210, 220, 230],
        '27': [11, 20, 29, 38, 48, 57, 67, 77, 87, 97, 107, 118, 125, 138, 147, 158, 168, 178, 188, 199, 209, 219, 230, 240, 250],
        '28': [12, 21, 30, 40, 50, 60, 70, 80, 90, 101, 111, 122, 132, 143, 154, 164, 175, 186, 196, 207, 218, 228, 239, 250, 261, 272],
        '29': [13, 22, 32, 42, 52, 62, 73, 83, 94, 105, 116, 127, 138, 149, 160, 171, 182, 193, 204, 215, 226, 238, 249, 260, 271, 282, 294],
        '30': [13, 23, 33, 43, 54, 65, 76, 87, 98, 109, 120, 131, 143, 154, 166, 177, 189, 200, 212, 223, 235, 247, 258, 270, 282, 293, 305, 317]
      };

      /*--------------------------------------------------------------------------*/

      /**
       * Create a new `Benchmark` function using the given `context` object.
       *
       * @static
       * @memberOf Benchmark
       * @param {Object} [context=root] The context object.
       * @returns {Function} Returns a new `Benchmark` function.
       */
      function runInContext(context) {
        // Exit early if unable to acquire lodash.
        var _ = context && context._ || require('lodash') || root._;
        if (!_) {
          Benchmark.runInContext = runInContext;
          return Benchmark;
        }
        // Avoid issues with some ES3 environments that attempt to use values, named
        // after built-in constructors like `Object`, for the creation of literals.
        // ES5 clears this up by stating that literals must use built-in constructors.
        // See http://es5.github.io/#x11.1.5.
        context = context ? _.defaults(root.Object(), context, _.pick(root, contextProps)) : root;

        /** Native constructor references. */
        context.Array;
            var Date = context.Date,
            Function = context.Function,
            Math = context.Math,
            Object = context.Object;
            context.RegExp;
            var String = context.String;

        /** Used for `Array` and `Object` method references. */
        var arrayRef = [],
            objectProto = Object.prototype;

        /** Native method shortcuts. */
        var abs = Math.abs,
            clearTimeout = context.clearTimeout,
            floor = Math.floor;
            Math.log;
            var max = Math.max,
            min = Math.min,
            pow = Math.pow,
            push = arrayRef.push;
            context.setTimeout;
            var shift = arrayRef.shift,
            slice = arrayRef.slice,
            sqrt = Math.sqrt;
            objectProto.toString;
            var unshift = arrayRef.unshift;

        /** Used to avoid inclusion in Browserified bundles. */
        var req = require;

        /** Detect DOM document object. */
        var doc = isHostType(context, 'document') && context.document;

        /** Used to access Wade Simmons' Node.js `microtime` module. */
        var microtimeObject = req('microtime');

        /** Used to access Node.js's high resolution timer. */
        var processObject = isHostType(context, 'process') && context.process;

        /** Used to prevent a `removeChild` memory leak in IE < 9. */
        var trash = doc && doc.createElement('div');

        /** Used to integrity check compiled tests. */
        var uid = 'uid' + _.now();

        /** Used to avoid infinite recursion when methods call each other. */
        var calledBy = {};

        /**
         * An object used to flag environments/features.
         *
         * @static
         * @memberOf Benchmark
         * @type Object
         */
        var support = {};

        (function() {

          /**
           * Detect if running in a browser environment.
           *
           * @memberOf Benchmark.support
           * @type boolean
           */
          support.browser = doc && isHostType(context, 'navigator') && !isHostType(context, 'phantom');

          /**
           * Detect if the Timers API exists.
           *
           * @memberOf Benchmark.support
           * @type boolean
           */
          support.timeout = isHostType(context, 'setTimeout') && isHostType(context, 'clearTimeout');

          /**
           * Detect if function decompilation is support.
           *
           * @name decompilation
           * @memberOf Benchmark.support
           * @type boolean
           */
          try {
            // Safari 2.x removes commas in object literals from `Function#toString` results.
            // See http://webk.it/11609 for more details.
            // Firefox 3.6 and Opera 9.25 strip grouping parentheses from `Function#toString` results.
            // See http://bugzil.la/559438 for more details.
            support.decompilation = Function(
              ('return (' + (function(x) { return { 'x': '' + (1 + x) + '', 'y': 0 }; }) + ')')
              // Avoid issues with code added by Istanbul.
              .replace(/__cov__[^;]+;/g, '')
            )()(0).x === '1';
          } catch(e) {
            support.decompilation = false;
          }
        }());

        /**
         * Timer object used by `clock()` and `Deferred#resolve`.
         *
         * @private
         * @type Object
         */
        var timer = {

          /**
           * The timer namespace object or constructor.
           *
           * @private
           * @memberOf timer
           * @type {Function|Object}
           */
          'ns': Date,

          /**
           * Starts the deferred timer.
           *
           * @private
           * @memberOf timer
           * @param {Object} deferred The deferred instance.
           */
          'start': null, // Lazy defined in `clock()`.

          /**
           * Stops the deferred timer.
           *
           * @private
           * @memberOf timer
           * @param {Object} deferred The deferred instance.
           */
          'stop': null // Lazy defined in `clock()`.
        };

        /*------------------------------------------------------------------------*/

        /**
         * The Benchmark constructor.
         *
         * Note: The Benchmark constructor exposes a handful of lodash methods to
         * make working with arrays, collections, and objects easier. The lodash
         * methods are:
         * [`each/forEach`](https://lodash.com/docs#forEach), [`forOwn`](https://lodash.com/docs#forOwn),
         * [`has`](https://lodash.com/docs#has), [`indexOf`](https://lodash.com/docs#indexOf),
         * [`map`](https://lodash.com/docs#map), and [`reduce`](https://lodash.com/docs#reduce)
         *
         * @constructor
         * @param {string} name A name to identify the benchmark.
         * @param {Function|string} fn The test to benchmark.
         * @param {Object} [options={}] Options object.
         * @example
         *
         * // basic usage (the `new` operator is optional)
         * var bench = new Benchmark(fn);
         *
         * // or using a name first
         * var bench = new Benchmark('foo', fn);
         *
         * // or with options
         * var bench = new Benchmark('foo', fn, {
         *
         *   // displayed by `Benchmark#toString` if `name` is not available
         *   'id': 'xyz',
         *
         *   // called when the benchmark starts running
         *   'onStart': onStart,
         *
         *   // called after each run cycle
         *   'onCycle': onCycle,
         *
         *   // called when aborted
         *   'onAbort': onAbort,
         *
         *   // called when a test errors
         *   'onError': onError,
         *
         *   // called when reset
         *   'onReset': onReset,
         *
         *   // called when the benchmark completes running
         *   'onComplete': onComplete,
         *
         *   // compiled/called before the test loop
         *   'setup': setup,
         *
         *   // compiled/called after the test loop
         *   'teardown': teardown
         * });
         *
         * // or name and options
         * var bench = new Benchmark('foo', {
         *
         *   // a flag to indicate the benchmark is deferred
         *   'defer': true,
         *
         *   // benchmark test function
         *   'fn': function(deferred) {
         *     // call `Deferred#resolve` when the deferred test is finished
         *     deferred.resolve();
         *   }
         * });
         *
         * // or options only
         * var bench = new Benchmark({
         *
         *   // benchmark name
         *   'name': 'foo',
         *
         *   // benchmark test as a string
         *   'fn': '[1,2,3,4].sort()'
         * });
         *
         * // a test's `this` binding is set to the benchmark instance
         * var bench = new Benchmark('foo', function() {
         *   'My name is '.concat(this.name); // "My name is foo"
         * });
         */
        function Benchmark(name, fn, options) {
          var bench = this;

          // Allow instance creation without the `new` operator.
          if (!(bench instanceof Benchmark)) {
            return new Benchmark(name, fn, options);
          }
          // Juggle arguments.
          if (_.isPlainObject(name)) {
            // 1 argument (options).
            options = name;
          }
          else if (_.isFunction(name)) {
            // 2 arguments (fn, options).
            options = fn;
            fn = name;
          }
          else if (_.isPlainObject(fn)) {
            // 2 arguments (name, options).
            options = fn;
            fn = null;
            bench.name = name;
          }
          else {
            // 3 arguments (name, fn [, options]).
            bench.name = name;
          }
          setOptions(bench, options);

          bench.id || (bench.id = ++counter);
          bench.fn == null && (bench.fn = fn);

          bench.stats = cloneDeep(bench.stats);
          bench.times = cloneDeep(bench.times);
        }

        /**
         * The Deferred constructor.
         *
         * @constructor
         * @memberOf Benchmark
         * @param {Object} clone The cloned benchmark instance.
         */
        function Deferred(clone) {
          var deferred = this;
          if (!(deferred instanceof Deferred)) {
            return new Deferred(clone);
          }
          deferred.benchmark = clone;
          clock(deferred);
        }

        /**
         * The Event constructor.
         *
         * @constructor
         * @memberOf Benchmark
         * @param {Object|string} type The event type.
         */
        function Event(type) {
          var event = this;
          if (type instanceof Event) {
            return type;
          }
          return (event instanceof Event)
            ? _.assign(event, { 'timeStamp': _.now() }, typeof type == 'string' ? { 'type': type } : type)
            : new Event(type);
        }

        /**
         * The Suite constructor.
         *
         * Note: Each Suite instance has a handful of wrapped lodash methods to
         * make working with Suites easier. The wrapped lodash methods are:
         * [`each/forEach`](https://lodash.com/docs#forEach), [`indexOf`](https://lodash.com/docs#indexOf),
         * [`map`](https://lodash.com/docs#map), and [`reduce`](https://lodash.com/docs#reduce)
         *
         * @constructor
         * @memberOf Benchmark
         * @param {string} name A name to identify the suite.
         * @param {Object} [options={}] Options object.
         * @example
         *
         * // basic usage (the `new` operator is optional)
         * var suite = new Benchmark.Suite;
         *
         * // or using a name first
         * var suite = new Benchmark.Suite('foo');
         *
         * // or with options
         * var suite = new Benchmark.Suite('foo', {
         *
         *   // called when the suite starts running
         *   'onStart': onStart,
         *
         *   // called between running benchmarks
         *   'onCycle': onCycle,
         *
         *   // called when aborted
         *   'onAbort': onAbort,
         *
         *   // called when a test errors
         *   'onError': onError,
         *
         *   // called when reset
         *   'onReset': onReset,
         *
         *   // called when the suite completes running
         *   'onComplete': onComplete
         * });
         */
        function Suite(name, options) {
          var suite = this;

          // Allow instance creation without the `new` operator.
          if (!(suite instanceof Suite)) {
            return new Suite(name, options);
          }
          // Juggle arguments.
          if (_.isPlainObject(name)) {
            // 1 argument (options).
            options = name;
          } else {
            // 2 arguments (name [, options]).
            suite.name = name;
          }
          setOptions(suite, options);
        }

        /*------------------------------------------------------------------------*/

        /**
         * A specialized version of `_.cloneDeep` which only clones arrays and plain
         * objects assigning all other values by reference.
         *
         * @private
         * @param {*} value The value to clone.
         * @returns {*} The cloned value.
         */
        var cloneDeep = _.partial(_.cloneDeepWith, _, function(value) {
          // Only clone primitives, arrays, and plain objects.
          if (!_.isArray(value) && !_.isPlainObject(value)) {
            return value;
          }
        });

        /**
         * Creates a function from the given arguments string and body.
         *
         * @private
         * @param {string} args The comma separated function arguments.
         * @param {string} body The function body.
         * @returns {Function} The new function.
         */
        function createFunction() {
          // Lazy define.
          createFunction = function(args, body) {
            var result,
                anchor = freeDefine ? freeDefine.amd : Benchmark,
                prop = uid + 'createFunction';

            runScript((freeDefine ? 'define.amd.' : 'Benchmark.') + prop + '=function(' + args + '){' + body + '}');
            result = anchor[prop];
            delete anchor[prop];
            return result;
          };
          // Fix JaegerMonkey bug.
          // For more information see http://bugzil.la/639720.
          createFunction = support.browser && (createFunction('', 'return"' + uid + '"') || _.noop)() == uid ? createFunction : Function;
          return createFunction.apply(null, arguments);
        }

        /**
         * Delay the execution of a function based on the benchmark's `delay` property.
         *
         * @private
         * @param {Object} bench The benchmark instance.
         * @param {Object} fn The function to execute.
         */
        function delay(bench, fn) {
          bench._timerId = _.delay(fn, bench.delay * 1e3);
        }

        /**
         * Destroys the given element.
         *
         * @private
         * @param {Element} element The element to destroy.
         */
        function destroyElement(element) {
          trash.appendChild(element);
          trash.innerHTML = '';
        }

        /**
         * Gets the name of the first argument from a function's source.
         *
         * @private
         * @param {Function} fn The function.
         * @returns {string} The argument name.
         */
        function getFirstArgument(fn) {
          return (!_.has(fn, 'toString') &&
            (/^[\s(]*function[^(]*\(([^\s,)]+)/.exec(fn) || 0)[1]) || '';
        }

        /**
         * Computes the arithmetic mean of a sample.
         *
         * @private
         * @param {Array} sample The sample.
         * @returns {number} The mean.
         */
        function getMean(sample) {
          return (_.reduce(sample, function(sum, x) {
            return sum + x;
          }) / sample.length) || 0;
        }

        /**
         * Gets the source code of a function.
         *
         * @private
         * @param {Function} fn The function.
         * @returns {string} The function's source code.
         */
        function getSource(fn) {
          var result = '';
          if (isStringable(fn)) {
            result = String(fn);
          } else if (support.decompilation) {
            // Escape the `{` for Firefox 1.
            result = _.result(/^[^{]+\{([\s\S]*)\}\s*$/.exec(fn), 1);
          }
          // Trim string.
          result = (result || '').replace(/^\s+|\s+$/g, '');

          // Detect strings containing only the "use strict" directive.
          return /^(?:\/\*+[\w\W]*?\*\/|\/\/.*?[\n\r\u2028\u2029]|\s)*(["'])use strict\1;?$/.test(result)
            ? ''
            : result;
        }

        /**
         * Host objects can return type values that are different from their actual
         * data type. The objects we are concerned with usually return non-primitive
         * types of "object", "function", or "unknown".
         *
         * @private
         * @param {*} object The owner of the property.
         * @param {string} property The property to check.
         * @returns {boolean} Returns `true` if the property value is a non-primitive, else `false`.
         */
        function isHostType(object, property) {
          if (object == null) {
            return false;
          }
          var type = typeof object[property];
          return !rePrimitive.test(type) && (type != 'object' || !!object[property]);
        }

        /**
         * Checks if a value can be safely coerced to a string.
         *
         * @private
         * @param {*} value The value to check.
         * @returns {boolean} Returns `true` if the value can be coerced, else `false`.
         */
        function isStringable(value) {
          return _.isString(value) || (_.has(value, 'toString') && _.isFunction(value.toString));
        }

        /**
         * A wrapper around `require` to suppress `module missing` errors.
         *
         * @private
         * @param {string} id The module id.
         * @returns {*} The exported module or `null`.
         */
        function require(id) {
          try {
            var result = freeExports && freeRequire(id);
          } catch(e) {}
          return result || null;
        }

        /**
         * Runs a snippet of JavaScript via script injection.
         *
         * @private
         * @param {string} code The code to run.
         */
        function runScript(code) {
          var anchor = freeDefine ? define.amd : Benchmark,
              script = doc.createElement('script'),
              sibling = doc.getElementsByTagName('script')[0],
              parent = sibling.parentNode,
              prop = uid + 'runScript',
              prefix = '(' + (freeDefine ? 'define.amd.' : 'Benchmark.') + prop + '||function(){})();';

          // Firefox 2.0.0.2 cannot use script injection as intended because it executes
          // asynchronously, but that's OK because script injection is only used to avoid
          // the previously commented JaegerMonkey bug.
          try {
            // Remove the inserted script *before* running the code to avoid differences
            // in the expected script element count/order of the document.
            script.appendChild(doc.createTextNode(prefix + code));
            anchor[prop] = function() { destroyElement(script); };
          } catch(e) {
            parent = parent.cloneNode(false);
            sibling = null;
            script.text = code;
          }
          parent.insertBefore(script, sibling);
          delete anchor[prop];
        }

        /**
         * A helper function for setting options/event handlers.
         *
         * @private
         * @param {Object} object The benchmark or suite instance.
         * @param {Object} [options={}] Options object.
         */
        function setOptions(object, options) {
          options = object.options = _.assign({}, cloneDeep(object.constructor.options), cloneDeep(options));

          _.forOwn(options, function(value, key) {
            if (value != null) {
              // Add event listeners.
              if (/^on[A-Z]/.test(key)) {
                _.each(key.split(' '), function(key) {
                  object.on(key.slice(2).toLowerCase(), value);
                });
              } else if (!_.has(object, key)) {
                object[key] = cloneDeep(value);
              }
            }
          });
        }

        /*------------------------------------------------------------------------*/

        /**
         * Handles cycling/completing the deferred benchmark.
         *
         * @memberOf Benchmark.Deferred
         */
        function resolve() {
          var deferred = this,
              clone = deferred.benchmark,
              bench = clone._original;

          if (bench.aborted) {
            // cycle() -> clone cycle/complete event -> compute()'s invoked bench.run() cycle/complete.
            deferred.teardown();
            clone.running = false;
            cycle(deferred);
          }
          else if (++deferred.cycles < clone.count) {
            clone.compiled.call(deferred, context, timer);
          }
          else {
            timer.stop(deferred);
            deferred.teardown();
            delay(clone, function() { cycle(deferred); });
          }
        }

        /*------------------------------------------------------------------------*/

        /**
         * A generic `Array#filter` like method.
         *
         * @static
         * @memberOf Benchmark
         * @param {Array} array The array to iterate over.
         * @param {Function|string} callback The function/alias called per iteration.
         * @returns {Array} A new array of values that passed callback filter.
         * @example
         *
         * // get odd numbers
         * Benchmark.filter([1, 2, 3, 4, 5], function(n) {
         *   return n % 2;
         * }); // -> [1, 3, 5];
         *
         * // get fastest benchmarks
         * Benchmark.filter(benches, 'fastest');
         *
         * // get slowest benchmarks
         * Benchmark.filter(benches, 'slowest');
         *
         * // get benchmarks that completed without erroring
         * Benchmark.filter(benches, 'successful');
         */
        function filter(array, callback) {
          if (callback === 'successful') {
            // Callback to exclude those that are errored, unrun, or have hz of Infinity.
            callback = function(bench) {
              return bench.cycles && _.isFinite(bench.hz) && !bench.error;
            };
          }
          else if (callback === 'fastest' || callback === 'slowest') {
            // Get successful, sort by period + margin of error, and filter fastest/slowest.
            var result = filter(array, 'successful').sort(function(a, b) {
              a = a.stats; b = b.stats;
              return (a.mean + a.moe > b.mean + b.moe ? 1 : -1) * (callback === 'fastest' ? 1 : -1);
            });

            return _.filter(result, function(bench) {
              return result[0].compare(bench) == 0;
            });
          }
          return _.filter(array, callback);
        }

        /**
         * Converts a number to a more readable comma-separated string representation.
         *
         * @static
         * @memberOf Benchmark
         * @param {number} number The number to convert.
         * @returns {string} The more readable string representation.
         */
        function formatNumber(number) {
          number = String(number).split('.');
          return number[0].replace(/(?=(?:\d{3})+$)(?!\b)/g, ',') +
            (number[1] ? '.' + number[1] : '');
        }

        /**
         * Invokes a method on all items in an array.
         *
         * @static
         * @memberOf Benchmark
         * @param {Array} benches Array of benchmarks to iterate over.
         * @param {Object|string} name The name of the method to invoke OR options object.
         * @param {...*} [args] Arguments to invoke the method with.
         * @returns {Array} A new array of values returned from each method invoked.
         * @example
         *
         * // invoke `reset` on all benchmarks
         * Benchmark.invoke(benches, 'reset');
         *
         * // invoke `emit` with arguments
         * Benchmark.invoke(benches, 'emit', 'complete', listener);
         *
         * // invoke `run(true)`, treat benchmarks as a queue, and register invoke callbacks
         * Benchmark.invoke(benches, {
         *
         *   // invoke the `run` method
         *   'name': 'run',
         *
         *   // pass a single argument
         *   'args': true,
         *
         *   // treat as queue, removing benchmarks from front of `benches` until empty
         *   'queued': true,
         *
         *   // called before any benchmarks have been invoked.
         *   'onStart': onStart,
         *
         *   // called between invoking benchmarks
         *   'onCycle': onCycle,
         *
         *   // called after all benchmarks have been invoked.
         *   'onComplete': onComplete
         * });
         */
        function invoke(benches, name) {
          var args,
              bench,
              queued,
              index = -1,
              eventProps = { 'currentTarget': benches },
              options = { 'onStart': _.noop, 'onCycle': _.noop, 'onComplete': _.noop },
              result = _.toArray(benches);

          /**
           * Invokes the method of the current object and if synchronous, fetches the next.
           */
          function execute() {
            var listeners,
                async = isAsync(bench);

            if (async) {
              // Use `getNext` as the first listener.
              bench.on('complete', getNext);
              listeners = bench.events.complete;
              listeners.splice(0, 0, listeners.pop());
            }
            // Execute method.
            result[index] = _.isFunction(bench && bench[name]) ? bench[name].apply(bench, args) : undefined$1;
            // If synchronous return `true` until finished.
            return !async && getNext();
          }

          /**
           * Fetches the next bench or executes `onComplete` callback.
           */
          function getNext(event) {
            var cycleEvent,
                last = bench,
                async = isAsync(last);

            if (async) {
              last.off('complete', getNext);
              last.emit('complete');
            }
            // Emit "cycle" event.
            eventProps.type = 'cycle';
            eventProps.target = last;
            cycleEvent = Event(eventProps);
            options.onCycle.call(benches, cycleEvent);

            // Choose next benchmark if not exiting early.
            if (!cycleEvent.aborted && raiseIndex() !== false) {
              bench = queued ? benches[0] : result[index];
              if (isAsync(bench)) {
                delay(bench, execute);
              }
              else if (async) {
                // Resume execution if previously asynchronous but now synchronous.
                while (execute()) {}
              }
              else {
                // Continue synchronous execution.
                return true;
              }
            } else {
              // Emit "complete" event.
              eventProps.type = 'complete';
              options.onComplete.call(benches, Event(eventProps));
            }
            // When used as a listener `event.aborted = true` will cancel the rest of
            // the "complete" listeners because they were already called above and when
            // used as part of `getNext` the `return false` will exit the execution while-loop.
            if (event) {
              event.aborted = true;
            } else {
              return false;
            }
          }

          /**
           * Checks if invoking `Benchmark#run` with asynchronous cycles.
           */
          function isAsync(object) {
            // Avoid using `instanceof` here because of IE memory leak issues with host objects.
            var async = args[0] && args[0].async;
            return name == 'run' && (object instanceof Benchmark) &&
              ((async == null ? object.options.async : async) && support.timeout || object.defer);
          }

          /**
           * Raises `index` to the next defined index or returns `false`.
           */
          function raiseIndex() {
            index++;

            // If queued remove the previous bench.
            if (queued && index > 0) {
              shift.call(benches);
            }
            // If we reached the last index then return `false`.
            return (queued ? benches.length : index < result.length)
              ? index
              : (index = false);
          }
          // Juggle arguments.
          if (_.isString(name)) {
            // 2 arguments (array, name).
            args = slice.call(arguments, 2);
          } else {
            // 2 arguments (array, options).
            options = _.assign(options, name);
            name = options.name;
            args = _.isArray(args = 'args' in options ? options.args : []) ? args : [args];
            queued = options.queued;
          }
          // Start iterating over the array.
          if (raiseIndex() !== false) {
            // Emit "start" event.
            bench = result[index];
            eventProps.type = 'start';
            eventProps.target = bench;
            options.onStart.call(benches, Event(eventProps));

            // End early if the suite was aborted in an "onStart" listener.
            if (name == 'run' && (benches instanceof Suite) && benches.aborted) {
              // Emit "cycle" event.
              eventProps.type = 'cycle';
              options.onCycle.call(benches, Event(eventProps));
              // Emit "complete" event.
              eventProps.type = 'complete';
              options.onComplete.call(benches, Event(eventProps));
            }
            // Start method execution.
            else {
              if (isAsync(bench)) {
                delay(bench, execute);
              } else {
                while (execute()) {}
              }
            }
          }
          return result;
        }

        /**
         * Creates a string of joined array values or object key-value pairs.
         *
         * @static
         * @memberOf Benchmark
         * @param {Array|Object} object The object to operate on.
         * @param {string} [separator1=','] The separator used between key-value pairs.
         * @param {string} [separator2=': '] The separator used between keys and values.
         * @returns {string} The joined result.
         */
        function join(object, separator1, separator2) {
          var result = [],
              length = (object = Object(object)).length,
              arrayLike = length === length >>> 0;

          separator2 || (separator2 = ': ');
          _.each(object, function(value, key) {
            result.push(arrayLike ? value : key + separator2 + value);
          });
          return result.join(separator1 || ',');
        }

        /*------------------------------------------------------------------------*/

        /**
         * Aborts all benchmarks in the suite.
         *
         * @name abort
         * @memberOf Benchmark.Suite
         * @returns {Object} The suite instance.
         */
        function abortSuite() {
          var event,
              suite = this,
              resetting = calledBy.resetSuite;

          if (suite.running) {
            event = Event('abort');
            suite.emit(event);
            if (!event.cancelled || resetting) {
              // Avoid infinite recursion.
              calledBy.abortSuite = true;
              suite.reset();
              delete calledBy.abortSuite;

              if (!resetting) {
                suite.aborted = true;
                invoke(suite, 'abort');
              }
            }
          }
          return suite;
        }

        /**
         * Adds a test to the benchmark suite.
         *
         * @memberOf Benchmark.Suite
         * @param {string} name A name to identify the benchmark.
         * @param {Function|string} fn The test to benchmark.
         * @param {Object} [options={}] Options object.
         * @returns {Object} The suite instance.
         * @example
         *
         * // basic usage
         * suite.add(fn);
         *
         * // or using a name first
         * suite.add('foo', fn);
         *
         * // or with options
         * suite.add('foo', fn, {
         *   'onCycle': onCycle,
         *   'onComplete': onComplete
         * });
         *
         * // or name and options
         * suite.add('foo', {
         *   'fn': fn,
         *   'onCycle': onCycle,
         *   'onComplete': onComplete
         * });
         *
         * // or options only
         * suite.add({
         *   'name': 'foo',
         *   'fn': fn,
         *   'onCycle': onCycle,
         *   'onComplete': onComplete
         * });
         */
        function add(name, fn, options) {
          var suite = this,
              bench = new Benchmark(name, fn, options),
              event = Event({ 'type': 'add', 'target': bench });

          if (suite.emit(event), !event.cancelled) {
            suite.push(bench);
          }
          return suite;
        }

        /**
         * Creates a new suite with cloned benchmarks.
         *
         * @name clone
         * @memberOf Benchmark.Suite
         * @param {Object} options Options object to overwrite cloned options.
         * @returns {Object} The new suite instance.
         */
        function cloneSuite(options) {
          var suite = this,
              result = new suite.constructor(_.assign({}, suite.options, options));

          // Copy own properties.
          _.forOwn(suite, function(value, key) {
            if (!_.has(result, key)) {
              result[key] = _.isFunction(_.get(value, 'clone'))
                ? value.clone()
                : cloneDeep(value);
            }
          });
          return result;
        }

        /**
         * An `Array#filter` like method.
         *
         * @name filter
         * @memberOf Benchmark.Suite
         * @param {Function|string} callback The function/alias called per iteration.
         * @returns {Object} A new suite of benchmarks that passed callback filter.
         */
        function filterSuite(callback) {
          var suite = this,
              result = new suite.constructor(suite.options);

          result.push.apply(result, filter(suite, callback));
          return result;
        }

        /**
         * Resets all benchmarks in the suite.
         *
         * @name reset
         * @memberOf Benchmark.Suite
         * @returns {Object} The suite instance.
         */
        function resetSuite() {
          var event,
              suite = this,
              aborting = calledBy.abortSuite;

          if (suite.running && !aborting) {
            // No worries, `resetSuite()` is called within `abortSuite()`.
            calledBy.resetSuite = true;
            suite.abort();
            delete calledBy.resetSuite;
          }
          // Reset if the state has changed.
          else if ((suite.aborted || suite.running) &&
              (suite.emit(event = Event('reset')), !event.cancelled)) {
            suite.aborted = suite.running = false;
            if (!aborting) {
              invoke(suite, 'reset');
            }
          }
          return suite;
        }

        /**
         * Runs the suite.
         *
         * @name run
         * @memberOf Benchmark.Suite
         * @param {Object} [options={}] Options object.
         * @returns {Object} The suite instance.
         * @example
         *
         * // basic usage
         * suite.run();
         *
         * // or with options
         * suite.run({ 'async': true, 'queued': true });
         */
        function runSuite(options) {
          var suite = this;

          suite.reset();
          suite.running = true;
          options || (options = {});

          invoke(suite, {
            'name': 'run',
            'args': options,
            'queued': options.queued,
            'onStart': function(event) {
              suite.emit(event);
            },
            'onCycle': function(event) {
              var bench = event.target;
              if (bench.error) {
                suite.emit({ 'type': 'error', 'target': bench });
              }
              suite.emit(event);
              event.aborted = suite.aborted;
            },
            'onComplete': function(event) {
              suite.running = false;
              suite.emit(event);
            }
          });
          return suite;
        }

        /*------------------------------------------------------------------------*/

        /**
         * Executes all registered listeners of the specified event type.
         *
         * @memberOf Benchmark, Benchmark.Suite
         * @param {Object|string} type The event type or object.
         * @param {...*} [args] Arguments to invoke the listener with.
         * @returns {*} Returns the return value of the last listener executed.
         */
        function emit(type) {
          var listeners,
              object = this,
              event = Event(type),
              events = object.events,
              args = (arguments[0] = event, arguments);

          event.currentTarget || (event.currentTarget = object);
          event.target || (event.target = object);
          delete event.result;

          if (events && (listeners = _.has(events, event.type) && events[event.type])) {
            _.each(listeners.slice(), function(listener) {
              if ((event.result = listener.apply(object, args)) === false) {
                event.cancelled = true;
              }
              return !event.aborted;
            });
          }
          return event.result;
        }

        /**
         * Returns an array of event listeners for a given type that can be manipulated
         * to add or remove listeners.
         *
         * @memberOf Benchmark, Benchmark.Suite
         * @param {string} type The event type.
         * @returns {Array} The listeners array.
         */
        function listeners(type) {
          var object = this,
              events = object.events || (object.events = {});

          return _.has(events, type) ? events[type] : (events[type] = []);
        }

        /**
         * Unregisters a listener for the specified event type(s),
         * or unregisters all listeners for the specified event type(s),
         * or unregisters all listeners for all event types.
         *
         * @memberOf Benchmark, Benchmark.Suite
         * @param {string} [type] The event type.
         * @param {Function} [listener] The function to unregister.
         * @returns {Object} The current instance.
         * @example
         *
         * // unregister a listener for an event type
         * bench.off('cycle', listener);
         *
         * // unregister a listener for multiple event types
         * bench.off('start cycle', listener);
         *
         * // unregister all listeners for an event type
         * bench.off('cycle');
         *
         * // unregister all listeners for multiple event types
         * bench.off('start cycle complete');
         *
         * // unregister all listeners for all event types
         * bench.off();
         */
        function off(type, listener) {
          var object = this,
              events = object.events;

          if (!events) {
            return object;
          }
          _.each(type ? type.split(' ') : events, function(listeners, type) {
            var index;
            if (typeof listeners == 'string') {
              type = listeners;
              listeners = _.has(events, type) && events[type];
            }
            if (listeners) {
              if (listener) {
                index = _.indexOf(listeners, listener);
                if (index > -1) {
                  listeners.splice(index, 1);
                }
              } else {
                listeners.length = 0;
              }
            }
          });
          return object;
        }

        /**
         * Registers a listener for the specified event type(s).
         *
         * @memberOf Benchmark, Benchmark.Suite
         * @param {string} type The event type.
         * @param {Function} listener The function to register.
         * @returns {Object} The current instance.
         * @example
         *
         * // register a listener for an event type
         * bench.on('cycle', listener);
         *
         * // register a listener for multiple event types
         * bench.on('start cycle', listener);
         */
        function on(type, listener) {
          var object = this,
              events = object.events || (object.events = {});

          _.each(type.split(' '), function(type) {
            (_.has(events, type)
              ? events[type]
              : (events[type] = [])
            ).push(listener);
          });
          return object;
        }

        /*------------------------------------------------------------------------*/

        /**
         * Aborts the benchmark without recording times.
         *
         * @memberOf Benchmark
         * @returns {Object} The benchmark instance.
         */
        function abort() {
          var event,
              bench = this,
              resetting = calledBy.reset;

          if (bench.running) {
            event = Event('abort');
            bench.emit(event);
            if (!event.cancelled || resetting) {
              // Avoid infinite recursion.
              calledBy.abort = true;
              bench.reset();
              delete calledBy.abort;

              if (support.timeout) {
                clearTimeout(bench._timerId);
                delete bench._timerId;
              }
              if (!resetting) {
                bench.aborted = true;
                bench.running = false;
              }
            }
          }
          return bench;
        }

        /**
         * Creates a new benchmark using the same test and options.
         *
         * @memberOf Benchmark
         * @param {Object} options Options object to overwrite cloned options.
         * @returns {Object} The new benchmark instance.
         * @example
         *
         * var bizarro = bench.clone({
         *   'name': 'doppelganger'
         * });
         */
        function clone(options) {
          var bench = this,
              result = new bench.constructor(_.assign({}, bench, options));

          // Correct the `options` object.
          result.options = _.assign({}, cloneDeep(bench.options), cloneDeep(options));

          // Copy own custom properties.
          _.forOwn(bench, function(value, key) {
            if (!_.has(result, key)) {
              result[key] = cloneDeep(value);
            }
          });

          return result;
        }

        /**
         * Determines if a benchmark is faster than another.
         *
         * @memberOf Benchmark
         * @param {Object} other The benchmark to compare.
         * @returns {number} Returns `-1` if slower, `1` if faster, and `0` if indeterminate.
         */
        function compare(other) {
          var bench = this;

          // Exit early if comparing the same benchmark.
          if (bench == other) {
            return 0;
          }
          var critical,
              zStat,
              sample1 = bench.stats.sample,
              sample2 = other.stats.sample,
              size1 = sample1.length,
              size2 = sample2.length,
              maxSize = max(size1, size2),
              minSize = min(size1, size2),
              u1 = getU(sample1, sample2),
              u2 = getU(sample2, sample1),
              u = min(u1, u2);

          function getScore(xA, sampleB) {
            return _.reduce(sampleB, function(total, xB) {
              return total + (xB > xA ? 0 : xB < xA ? 1 : 0.5);
            }, 0);
          }

          function getU(sampleA, sampleB) {
            return _.reduce(sampleA, function(total, xA) {
              return total + getScore(xA, sampleB);
            }, 0);
          }

          function getZ(u) {
            return (u - ((size1 * size2) / 2)) / sqrt((size1 * size2 * (size1 + size2 + 1)) / 12);
          }
          // Reject the null hypothesis the two samples come from the
          // same population (i.e. have the same median) if...
          if (size1 + size2 > 30) {
            // ...the z-stat is greater than 1.96 or less than -1.96
            // http://www.statisticslectures.com/topics/mannwhitneyu/
            zStat = getZ(u);
            return abs(zStat) > 1.96 ? (u == u1 ? 1 : -1) : 0;
          }
          // ...the U value is less than or equal the critical U value.
          critical = maxSize < 5 || minSize < 3 ? 0 : uTable[maxSize][minSize - 3];
          return u <= critical ? (u == u1 ? 1 : -1) : 0;
        }

        /**
         * Reset properties and abort if running.
         *
         * @memberOf Benchmark
         * @returns {Object} The benchmark instance.
         */
        function reset() {
          var bench = this;
          if (bench.running && !calledBy.abort) {
            // No worries, `reset()` is called within `abort()`.
            calledBy.reset = true;
            bench.abort();
            delete calledBy.reset;
            return bench;
          }
          var event,
              index = 0,
              changes = [],
              queue = [];

          // A non-recursive solution to check if properties have changed.
          // For more information see http://www.jslab.dk/articles/non.recursive.preorder.traversal.part4.
          var data = {
            'destination': bench,
            'source': _.assign({}, cloneDeep(bench.constructor.prototype), cloneDeep(bench.options))
          };

          do {
            _.forOwn(data.source, function(value, key) {
              var changed,
                  destination = data.destination,
                  currValue = destination[key];

              // Skip pseudo private properties and event listeners.
              if (/^_|^events$|^on[A-Z]/.test(key)) {
                return;
              }
              if (_.isObjectLike(value)) {
                if (_.isArray(value)) {
                  // Check if an array value has changed to a non-array value.
                  if (!_.isArray(currValue)) {
                    changed = true;
                    currValue = [];
                  }
                  // Check if an array has changed its length.
                  if (currValue.length != value.length) {
                    changed = true;
                    currValue = currValue.slice(0, value.length);
                    currValue.length = value.length;
                  }
                }
                // Check if an object has changed to a non-object value.
                else if (!_.isObjectLike(currValue)) {
                  changed = true;
                  currValue = {};
                }
                // Register a changed object.
                if (changed) {
                  changes.push({ 'destination': destination, 'key': key, 'value': currValue });
                }
                queue.push({ 'destination': currValue, 'source': value });
              }
              // Register a changed primitive.
              else if (!_.eq(currValue, value) && value !== undefined$1) {
                changes.push({ 'destination': destination, 'key': key, 'value': value });
              }
            });
          }
          while ((data = queue[index++]));

          // If changed emit the `reset` event and if it isn't cancelled reset the benchmark.
          if (changes.length &&
              (bench.emit(event = Event('reset')), !event.cancelled)) {
            _.each(changes, function(data) {
              data.destination[data.key] = data.value;
            });
          }
          return bench;
        }

        /**
         * Displays relevant benchmark information when coerced to a string.
         *
         * @name toString
         * @memberOf Benchmark
         * @returns {string} A string representation of the benchmark instance.
         */
        function toStringBench() {
          var bench = this,
              error = bench.error,
              hz = bench.hz,
              id = bench.id,
              stats = bench.stats,
              size = stats.sample.length,
              pm = '\xb1',
              result = bench.name || (_.isNaN(id) ? id : '<Test #' + id + '>');

          if (error) {
            var errorStr;
            if (!_.isObject(error)) {
              errorStr = String(error);
            } else if (!_.isError(Error)) {
              errorStr = join(error);
            } else {
              // Error#name and Error#message properties are non-enumerable.
              errorStr = join(_.assign({ 'name': error.name, 'message': error.message }, error));
            }
            result += ': ' + errorStr;
          }
          else {
            result += ' x ' + formatNumber(hz.toFixed(hz < 100 ? 2 : 0)) + ' ops/sec ' + pm +
              stats.rme.toFixed(2) + '% (' + size + ' run' + (size == 1 ? '' : 's') + ' sampled)';
          }
          return result;
        }

        /*------------------------------------------------------------------------*/

        /**
         * Clocks the time taken to execute a test per cycle (secs).
         *
         * @private
         * @param {Object} bench The benchmark instance.
         * @returns {number} The time taken.
         */
        function clock() {
          var options = Benchmark.options,
              templateData = {},
              timers = [{ 'ns': timer.ns, 'res': max(0.0015, getRes('ms')), 'unit': 'ms' }];

          // Lazy define for hi-res timers.
          clock = function(clone) {
            var deferred;

            if (clone instanceof Deferred) {
              deferred = clone;
              clone = deferred.benchmark;
            }
            var bench = clone._original,
                stringable = isStringable(bench.fn),
                count = bench.count = clone.count,
                decompilable = stringable || (support.decompilation && (clone.setup !== _.noop || clone.teardown !== _.noop)),
                id = bench.id,
                name = bench.name || (typeof id == 'number' ? '<Test #' + id + '>' : id),
                result = 0;

            // Init `minTime` if needed.
            clone.minTime = bench.minTime || (bench.minTime = bench.options.minTime = options.minTime);

            // Compile in setup/teardown functions and the test loop.
            // Create a new compiled test, instead of using the cached `bench.compiled`,
            // to avoid potential engine optimizations enabled over the life of the test.
            var funcBody = deferred
              ? 'var d#=this,${fnArg}=d#,m#=d#.benchmark._original,f#=m#.fn,su#=m#.setup,td#=m#.teardown;' +
                // When `deferred.cycles` is `0` then...
                'if(!d#.cycles){' +
                // set `deferred.fn`,
                'd#.fn=function(){var ${fnArg}=d#;if(typeof f#=="function"){try{${fn}\n}catch(e#){f#(d#)}}else{${fn}\n}};' +
                // set `deferred.teardown`,
                'd#.teardown=function(){d#.cycles=0;if(typeof td#=="function"){try{${teardown}\n}catch(e#){td#()}}else{${teardown}\n}};' +
                // execute the benchmark's `setup`,
                'if(typeof su#=="function"){try{${setup}\n}catch(e#){su#()}}else{${setup}\n};' +
                // start timer,
                't#.start(d#);' +
                // and then execute `deferred.fn` and return a dummy object.
                '}d#.fn();return{uid:"${uid}"}'

              : 'var r#,s#,m#=this,f#=m#.fn,i#=m#.count,n#=t#.ns;${setup}\n${begin};' +
                'while(i#--){${fn}\n}${end};${teardown}\nreturn{elapsed:r#,uid:"${uid}"}';

            var compiled = bench.compiled = clone.compiled = createCompiled(bench, decompilable, deferred, funcBody),
                isEmpty = !(templateData.fn || stringable);

            try {
              if (isEmpty) {
                // Firefox may remove dead code from `Function#toString` results.
                // For more information see http://bugzil.la/536085.
                throw new Error('The test "' + name + '" is empty. This may be the result of dead code removal.');
              }
              else if (!deferred) {
                // Pretest to determine if compiled code exits early, usually by a
                // rogue `return` statement, by checking for a return object with the uid.
                bench.count = 1;
                compiled = decompilable && (compiled.call(bench, context, timer) || {}).uid == templateData.uid && compiled;
                bench.count = count;
              }
            } catch(e) {
              compiled = null;
              clone.error = e || new Error(String(e));
              bench.count = count;
            }
            // Fallback when a test exits early or errors during pretest.
            if (!compiled && !deferred && !isEmpty) {
              funcBody = (
                stringable || (decompilable && !clone.error)
                  ? 'function f#(){${fn}\n}var r#,s#,m#=this,i#=m#.count'
                  : 'var r#,s#,m#=this,f#=m#.fn,i#=m#.count'
                ) +
                ',n#=t#.ns;${setup}\n${begin};m#.f#=f#;while(i#--){m#.f#()}${end};' +
                'delete m#.f#;${teardown}\nreturn{elapsed:r#}';

              compiled = createCompiled(bench, decompilable, deferred, funcBody);

              try {
                // Pretest one more time to check for errors.
                bench.count = 1;
                compiled.call(bench, context, timer);
                bench.count = count;
                delete clone.error;
              }
              catch(e) {
                bench.count = count;
                if (!clone.error) {
                  clone.error = e || new Error(String(e));
                }
              }
            }
            // If no errors run the full test loop.
            if (!clone.error) {
              compiled = bench.compiled = clone.compiled = createCompiled(bench, decompilable, deferred, funcBody);
              result = compiled.call(deferred || bench, context, timer).elapsed;
            }
            return result;
          };

          /*----------------------------------------------------------------------*/

          /**
           * Creates a compiled function from the given function `body`.
           */
          function createCompiled(bench, decompilable, deferred, body) {
            var fn = bench.fn,
                fnArg = deferred ? getFirstArgument(fn) || 'deferred' : '';

            templateData.uid = uid + uidCounter++;

            _.assign(templateData, {
              'setup': decompilable ? getSource(bench.setup) : interpolate('m#.setup()'),
              'fn': decompilable ? getSource(fn) : interpolate('m#.fn(' + fnArg + ')'),
              'fnArg': fnArg,
              'teardown': decompilable ? getSource(bench.teardown) : interpolate('m#.teardown()')
            });

            // Use API of chosen timer.
            if (timer.unit == 'ns') {
              _.assign(templateData, {
                'begin': interpolate('s#=n#()'),
                'end': interpolate('r#=n#(s#);r#=r#[0]+(r#[1]/1e9)')
              });
            }
            else if (timer.unit == 'us') {
              if (timer.ns.stop) {
                _.assign(templateData, {
                  'begin': interpolate('s#=n#.start()'),
                  'end': interpolate('r#=n#.microseconds()/1e6')
                });
              } else {
                _.assign(templateData, {
                  'begin': interpolate('s#=n#()'),
                  'end': interpolate('r#=(n#()-s#)/1e6')
                });
              }
            }
            else if (timer.ns.now) {
              _.assign(templateData, {
                'begin': interpolate('s#=n#.now()'),
                'end': interpolate('r#=(n#.now()-s#)/1e3')
              });
            }
            else {
              _.assign(templateData, {
                'begin': interpolate('s#=new n#().getTime()'),
                'end': interpolate('r#=(new n#().getTime()-s#)/1e3')
              });
            }
            // Define `timer` methods.
            timer.start = createFunction(
              interpolate('o#'),
              interpolate('var n#=this.ns,${begin};o#.elapsed=0;o#.timeStamp=s#')
            );

            timer.stop = createFunction(
              interpolate('o#'),
              interpolate('var n#=this.ns,s#=o#.timeStamp,${end};o#.elapsed=r#')
            );

            // Create compiled test.
            return createFunction(
              interpolate('window,t#'),
              'var global = window, clearTimeout = global.clearTimeout, setTimeout = global.setTimeout;\n' +
              interpolate(body)
            );
          }

          /**
           * Gets the current timer's minimum resolution (secs).
           */
          function getRes(unit) {
            var measured,
                begin,
                count = 30,
                divisor = 1e3,
                ns = timer.ns,
                sample = [];

            // Get average smallest measurable time.
            while (count--) {
              if (unit == 'us') {
                divisor = 1e6;
                if (ns.stop) {
                  ns.start();
                  while (!(measured = ns.microseconds())) {}
                } else {
                  begin = ns();
                  while (!(measured = ns() - begin)) {}
                }
              }
              else if (unit == 'ns') {
                divisor = 1e9;
                begin = (begin = ns())[0] + (begin[1] / divisor);
                while (!(measured = ((measured = ns())[0] + (measured[1] / divisor)) - begin)) {}
                divisor = 1;
              }
              else if (ns.now) {
                begin = ns.now();
                while (!(measured = ns.now() - begin)) {}
              }
              else {
                begin = new ns().getTime();
                while (!(measured = new ns().getTime() - begin)) {}
              }
              // Check for broken timers.
              if (measured > 0) {
                sample.push(measured);
              } else {
                sample.push(Infinity);
                break;
              }
            }
            // Convert to seconds.
            return getMean(sample) / divisor;
          }

          /**
           * Interpolates a given template string.
           */
          function interpolate(string) {
            // Replaces all occurrences of `#` with a unique number and template tokens with content.
            return _.template(string.replace(/\#/g, /\d+/.exec(templateData.uid)))(templateData);
          }

          /*----------------------------------------------------------------------*/

          // Detect Chrome's microsecond timer:
          // enable benchmarking via the --enable-benchmarking command
          // line switch in at least Chrome 7 to use chrome.Interval
          try {
            if ((timer.ns = new (context.chrome || context.chromium).Interval)) {
              timers.push({ 'ns': timer.ns, 'res': getRes('us'), 'unit': 'us' });
            }
          } catch(e) {}

          // Detect Node.js's nanosecond resolution timer available in Node.js >= 0.8.
          if (processObject && typeof (timer.ns = processObject.hrtime) == 'function') {
            timers.push({ 'ns': timer.ns, 'res': getRes('ns'), 'unit': 'ns' });
          }
          // Detect Wade Simmons' Node.js `microtime` module.
          if (microtimeObject && typeof (timer.ns = microtimeObject.now) == 'function') {
            timers.push({ 'ns': timer.ns,  'res': getRes('us'), 'unit': 'us' });
          }
          // Pick timer with highest resolution.
          timer = _.minBy(timers, 'res');

          // Error if there are no working timers.
          if (timer.res == Infinity) {
            throw new Error('Benchmark.js was unable to find a working timer.');
          }
          // Resolve time span required to achieve a percent uncertainty of at most 1%.
          // For more information see http://spiff.rit.edu/classes/phys273/uncert/uncert.html.
          options.minTime || (options.minTime = max(timer.res / 2 / 0.01, 0.05));
          return clock.apply(null, arguments);
        }

        /*------------------------------------------------------------------------*/

        /**
         * Computes stats on benchmark results.
         *
         * @private
         * @param {Object} bench The benchmark instance.
         * @param {Object} options The options object.
         */
        function compute(bench, options) {
          options || (options = {});

          var async = options.async,
              elapsed = 0,
              initCount = bench.initCount,
              minSamples = bench.minSamples,
              queue = [],
              sample = bench.stats.sample;

          /**
           * Adds a clone to the queue.
           */
          function enqueue() {
            queue.push(_.assign(bench.clone(), {
              '_original': bench,
              'events': {
                'abort': [update],
                'cycle': [update],
                'error': [update],
                'start': [update]
              }
            }));
          }

          /**
           * Updates the clone/original benchmarks to keep their data in sync.
           */
          function update(event) {
            var clone = this,
                type = event.type;

            if (bench.running) {
              if (type == 'start') {
                // Note: `clone.minTime` prop is inited in `clock()`.
                clone.count = bench.initCount;
              }
              else {
                if (type == 'error') {
                  bench.error = clone.error;
                }
                if (type == 'abort') {
                  bench.abort();
                  bench.emit('cycle');
                } else {
                  event.currentTarget = event.target = bench;
                  bench.emit(event);
                }
              }
            } else if (bench.aborted) {
              // Clear abort listeners to avoid triggering bench's abort/cycle again.
              clone.events.abort.length = 0;
              clone.abort();
            }
          }

          /**
           * Determines if more clones should be queued or if cycling should stop.
           */
          function evaluate(event) {
            var critical,
                df,
                mean,
                moe,
                rme,
                sd,
                sem,
                variance,
                clone = event.target,
                done = bench.aborted,
                now = _.now(),
                size = sample.push(clone.times.period),
                maxedOut = size >= minSamples && (elapsed += now - clone.times.timeStamp) / 1e3 > bench.maxTime,
                times = bench.times,
                varOf = function(sum, x) { return sum + pow(x - mean, 2); };

            // Exit early for aborted or unclockable tests.
            if (done || clone.hz == Infinity) {
              maxedOut = !(size = sample.length = queue.length = 0);
            }

            if (!done) {
              // Compute the sample mean (estimate of the population mean).
              mean = getMean(sample);
              // Compute the sample variance (estimate of the population variance).
              variance = _.reduce(sample, varOf, 0) / (size - 1) || 0;
              // Compute the sample standard deviation (estimate of the population standard deviation).
              sd = sqrt(variance);
              // Compute the standard error of the mean (a.k.a. the standard deviation of the sampling distribution of the sample mean).
              sem = sd / sqrt(size);
              // Compute the degrees of freedom.
              df = size - 1;
              // Compute the critical value.
              critical = tTable[Math.round(df) || 1] || tTable.infinity;
              // Compute the margin of error.
              moe = sem * critical;
              // Compute the relative margin of error.
              rme = (moe / mean) * 100 || 0;

              _.assign(bench.stats, {
                'deviation': sd,
                'mean': mean,
                'moe': moe,
                'rme': rme,
                'sem': sem,
                'variance': variance
              });

              // Abort the cycle loop when the minimum sample size has been collected
              // and the elapsed time exceeds the maximum time allowed per benchmark.
              // We don't count cycle delays toward the max time because delays may be
              // increased by browsers that clamp timeouts for inactive tabs. For more
              // information see https://developer.mozilla.org/en/window.setTimeout#Inactive_tabs.
              if (maxedOut) {
                // Reset the `initCount` in case the benchmark is rerun.
                bench.initCount = initCount;
                bench.running = false;
                done = true;
                times.elapsed = (now - times.timeStamp) / 1e3;
              }
              if (bench.hz != Infinity) {
                bench.hz = 1 / mean;
                times.cycle = mean * bench.count;
                times.period = mean;
              }
            }
            // If time permits, increase sample size to reduce the margin of error.
            if (queue.length < 2 && !maxedOut) {
              enqueue();
            }
            // Abort the `invoke` cycle when done.
            event.aborted = done;
          }

          // Init queue and begin.
          enqueue();
          invoke(queue, {
            'name': 'run',
            'args': { 'async': async },
            'queued': true,
            'onCycle': evaluate,
            'onComplete': function() { bench.emit('complete'); }
          });
        }

        /*------------------------------------------------------------------------*/

        /**
         * Cycles a benchmark until a run `count` can be established.
         *
         * @private
         * @param {Object} clone The cloned benchmark instance.
         * @param {Object} options The options object.
         */
        function cycle(clone, options) {
          options || (options = {});

          var deferred;
          if (clone instanceof Deferred) {
            deferred = clone;
            clone = clone.benchmark;
          }
          var clocked,
              cycles,
              divisor,
              event,
              minTime,
              period,
              async = options.async,
              bench = clone._original,
              count = clone.count,
              times = clone.times;

          // Continue, if not aborted between cycles.
          if (clone.running) {
            // `minTime` is set to `Benchmark.options.minTime` in `clock()`.
            cycles = ++clone.cycles;
            clocked = deferred ? deferred.elapsed : clock(clone);
            minTime = clone.minTime;

            if (cycles > bench.cycles) {
              bench.cycles = cycles;
            }
            if (clone.error) {
              event = Event('error');
              event.message = clone.error;
              clone.emit(event);
              if (!event.cancelled) {
                clone.abort();
              }
            }
          }
          // Continue, if not errored.
          if (clone.running) {
            // Compute the time taken to complete last test cycle.
            bench.times.cycle = times.cycle = clocked;
            // Compute the seconds per operation.
            period = bench.times.period = times.period = clocked / count;
            // Compute the ops per second.
            bench.hz = clone.hz = 1 / period;
            // Avoid working our way up to this next time.
            bench.initCount = clone.initCount = count;
            // Do we need to do another cycle?
            clone.running = clocked < minTime;

            if (clone.running) {
              // Tests may clock at `0` when `initCount` is a small number,
              // to avoid that we set its count to something a bit higher.
              if (!clocked && (divisor = divisors[clone.cycles]) != null) {
                count = floor(4e6 / divisor);
              }
              // Calculate how many more iterations it will take to achieve the `minTime`.
              if (count <= clone.count) {
                count += Math.ceil((minTime - clocked) / period);
              }
              clone.running = count != Infinity;
            }
          }
          // Should we exit early?
          event = Event('cycle');
          clone.emit(event);
          if (event.aborted) {
            clone.abort();
          }
          // Figure out what to do next.
          if (clone.running) {
            // Start a new cycle.
            clone.count = count;
            if (deferred) {
              clone.compiled.call(deferred, context, timer);
            } else if (async) {
              delay(clone, function() { cycle(clone, options); });
            } else {
              cycle(clone);
            }
          }
          else {
            // Fix TraceMonkey bug associated with clock fallbacks.
            // For more information see http://bugzil.la/509069.
            if (support.browser) {
              runScript(uid + '=1;delete ' + uid);
            }
            // We're done.
            clone.emit('complete');
          }
        }

        /*------------------------------------------------------------------------*/

        /**
         * Runs the benchmark.
         *
         * @memberOf Benchmark
         * @param {Object} [options={}] Options object.
         * @returns {Object} The benchmark instance.
         * @example
         *
         * // basic usage
         * bench.run();
         *
         * // or with options
         * bench.run({ 'async': true });
         */
        function run(options) {
          var bench = this,
              event = Event('start');

          // Set `running` to `false` so `reset()` won't call `abort()`.
          bench.running = false;
          bench.reset();
          bench.running = true;

          bench.count = bench.initCount;
          bench.times.timeStamp = _.now();
          bench.emit(event);

          if (!event.cancelled) {
            options = { 'async': ((options = options && options.async) == null ? bench.async : options) && support.timeout };

            // For clones created within `compute()`.
            if (bench._original) {
              if (bench.defer) {
                Deferred(bench);
              } else {
                cycle(bench, options);
              }
            }
            // For original benchmarks.
            else {
              compute(bench, options);
            }
          }
          return bench;
        }

        /*------------------------------------------------------------------------*/

        // Firefox 1 erroneously defines variable and argument names of functions on
        // the function itself as non-configurable properties with `undefined` values.
        // The bugginess continues as the `Benchmark` constructor has an argument
        // named `options` and Firefox 1 will not assign a value to `Benchmark.options`,
        // making it non-writable in the process, unless it is the first property
        // assigned by for-in loop of `_.assign()`.
        _.assign(Benchmark, {

          /**
           * The default options copied by benchmark instances.
           *
           * @static
           * @memberOf Benchmark
           * @type Object
           */
          'options': {

            /**
             * A flag to indicate that benchmark cycles will execute asynchronously
             * by default.
             *
             * @memberOf Benchmark.options
             * @type boolean
             */
            'async': false,

            /**
             * A flag to indicate that the benchmark clock is deferred.
             *
             * @memberOf Benchmark.options
             * @type boolean
             */
            'defer': false,

            /**
             * The delay between test cycles (secs).
             * @memberOf Benchmark.options
             * @type number
             */
            'delay': 0.005,

            /**
             * Displayed by `Benchmark#toString` when a `name` is not available
             * (auto-generated if absent).
             *
             * @memberOf Benchmark.options
             * @type string
             */
            'id': undefined$1,

            /**
             * The default number of times to execute a test on a benchmark's first cycle.
             *
             * @memberOf Benchmark.options
             * @type number
             */
            'initCount': 1,

            /**
             * The maximum time a benchmark is allowed to run before finishing (secs).
             *
             * Note: Cycle delays aren't counted toward the maximum time.
             *
             * @memberOf Benchmark.options
             * @type number
             */
            'maxTime': 5,

            /**
             * The minimum sample size required to perform statistical analysis.
             *
             * @memberOf Benchmark.options
             * @type number
             */
            'minSamples': 5,

            /**
             * The time needed to reduce the percent uncertainty of measurement to 1% (secs).
             *
             * @memberOf Benchmark.options
             * @type number
             */
            'minTime': 0,

            /**
             * The name of the benchmark.
             *
             * @memberOf Benchmark.options
             * @type string
             */
            'name': undefined$1,

            /**
             * An event listener called when the benchmark is aborted.
             *
             * @memberOf Benchmark.options
             * @type Function
             */
            'onAbort': undefined$1,

            /**
             * An event listener called when the benchmark completes running.
             *
             * @memberOf Benchmark.options
             * @type Function
             */
            'onComplete': undefined$1,

            /**
             * An event listener called after each run cycle.
             *
             * @memberOf Benchmark.options
             * @type Function
             */
            'onCycle': undefined$1,

            /**
             * An event listener called when a test errors.
             *
             * @memberOf Benchmark.options
             * @type Function
             */
            'onError': undefined$1,

            /**
             * An event listener called when the benchmark is reset.
             *
             * @memberOf Benchmark.options
             * @type Function
             */
            'onReset': undefined$1,

            /**
             * An event listener called when the benchmark starts running.
             *
             * @memberOf Benchmark.options
             * @type Function
             */
            'onStart': undefined$1
          },

          /**
           * Platform object with properties describing things like browser name,
           * version, and operating system. See [`platform.js`](https://mths.be/platform).
           *
           * @static
           * @memberOf Benchmark
           * @type Object
           */
          'platform': context.platform || require('platform') || ({
            'description': context.navigator && context.navigator.userAgent || null,
            'layout': null,
            'product': null,
            'name': null,
            'manufacturer': null,
            'os': null,
            'prerelease': null,
            'version': null,
            'toString': function() {
              return this.description || '';
            }
          }),

          /**
           * The semantic version number.
           *
           * @static
           * @memberOf Benchmark
           * @type string
           */
          'version': '2.1.4'
        });

        _.assign(Benchmark, {
          'filter': filter,
          'formatNumber': formatNumber,
          'invoke': invoke,
          'join': join,
          'runInContext': runInContext,
          'support': support
        });

        // Add lodash methods to Benchmark.
        _.each(['each', 'forEach', 'forOwn', 'has', 'indexOf', 'map', 'reduce'], function(methodName) {
          Benchmark[methodName] = _[methodName];
        });

        /*------------------------------------------------------------------------*/

        _.assign(Benchmark.prototype, {

          /**
           * The number of times a test was executed.
           *
           * @memberOf Benchmark
           * @type number
           */
          'count': 0,

          /**
           * The number of cycles performed while benchmarking.
           *
           * @memberOf Benchmark
           * @type number
           */
          'cycles': 0,

          /**
           * The number of executions per second.
           *
           * @memberOf Benchmark
           * @type number
           */
          'hz': 0,

          /**
           * The compiled test function.
           *
           * @memberOf Benchmark
           * @type {Function|string}
           */
          'compiled': undefined$1,

          /**
           * The error object if the test failed.
           *
           * @memberOf Benchmark
           * @type Object
           */
          'error': undefined$1,

          /**
           * The test to benchmark.
           *
           * @memberOf Benchmark
           * @type {Function|string}
           */
          'fn': undefined$1,

          /**
           * A flag to indicate if the benchmark is aborted.
           *
           * @memberOf Benchmark
           * @type boolean
           */
          'aborted': false,

          /**
           * A flag to indicate if the benchmark is running.
           *
           * @memberOf Benchmark
           * @type boolean
           */
          'running': false,

          /**
           * Compiled into the test and executed immediately **before** the test loop.
           *
           * @memberOf Benchmark
           * @type {Function|string}
           * @example
           *
           * // basic usage
           * var bench = Benchmark({
           *   'setup': function() {
           *     var c = this.count,
           *         element = document.getElementById('container');
           *     while (c--) {
           *       element.appendChild(document.createElement('div'));
           *     }
           *   },
           *   'fn': function() {
           *     element.removeChild(element.lastChild);
           *   }
           * });
           *
           * // compiles to something like:
           * var c = this.count,
           *     element = document.getElementById('container');
           * while (c--) {
           *   element.appendChild(document.createElement('div'));
           * }
           * var start = new Date;
           * while (count--) {
           *   element.removeChild(element.lastChild);
           * }
           * var end = new Date - start;
           *
           * // or using strings
           * var bench = Benchmark({
           *   'setup': '\
           *     var a = 0;\n\
           *     (function() {\n\
           *       (function() {\n\
           *         (function() {',
           *   'fn': 'a += 1;',
           *   'teardown': '\
           *          }())\n\
           *        }())\n\
           *      }())'
           * });
           *
           * // compiles to something like:
           * var a = 0;
           * (function() {
           *   (function() {
           *     (function() {
           *       var start = new Date;
           *       while (count--) {
           *         a += 1;
           *       }
           *       var end = new Date - start;
           *     }())
           *   }())
           * }())
           */
          'setup': _.noop,

          /**
           * Compiled into the test and executed immediately **after** the test loop.
           *
           * @memberOf Benchmark
           * @type {Function|string}
           */
          'teardown': _.noop,

          /**
           * An object of stats including mean, margin or error, and standard deviation.
           *
           * @memberOf Benchmark
           * @type Object
           */
          'stats': {

            /**
             * The margin of error.
             *
             * @memberOf Benchmark#stats
             * @type number
             */
            'moe': 0,

            /**
             * The relative margin of error (expressed as a percentage of the mean).
             *
             * @memberOf Benchmark#stats
             * @type number
             */
            'rme': 0,

            /**
             * The standard error of the mean.
             *
             * @memberOf Benchmark#stats
             * @type number
             */
            'sem': 0,

            /**
             * The sample standard deviation.
             *
             * @memberOf Benchmark#stats
             * @type number
             */
            'deviation': 0,

            /**
             * The sample arithmetic mean (secs).
             *
             * @memberOf Benchmark#stats
             * @type number
             */
            'mean': 0,

            /**
             * The array of sampled periods.
             *
             * @memberOf Benchmark#stats
             * @type Array
             */
            'sample': [],

            /**
             * The sample variance.
             *
             * @memberOf Benchmark#stats
             * @type number
             */
            'variance': 0
          },

          /**
           * An object of timing data including cycle, elapsed, period, start, and stop.
           *
           * @memberOf Benchmark
           * @type Object
           */
          'times': {

            /**
             * The time taken to complete the last cycle (secs).
             *
             * @memberOf Benchmark#times
             * @type number
             */
            'cycle': 0,

            /**
             * The time taken to complete the benchmark (secs).
             *
             * @memberOf Benchmark#times
             * @type number
             */
            'elapsed': 0,

            /**
             * The time taken to execute the test once (secs).
             *
             * @memberOf Benchmark#times
             * @type number
             */
            'period': 0,

            /**
             * A timestamp of when the benchmark started (ms).
             *
             * @memberOf Benchmark#times
             * @type number
             */
            'timeStamp': 0
          }
        });

        _.assign(Benchmark.prototype, {
          'abort': abort,
          'clone': clone,
          'compare': compare,
          'emit': emit,
          'listeners': listeners,
          'off': off,
          'on': on,
          'reset': reset,
          'run': run,
          'toString': toStringBench
        });

        /*------------------------------------------------------------------------*/

        _.assign(Deferred.prototype, {

          /**
           * The deferred benchmark instance.
           *
           * @memberOf Benchmark.Deferred
           * @type Object
           */
          'benchmark': null,

          /**
           * The number of deferred cycles performed while benchmarking.
           *
           * @memberOf Benchmark.Deferred
           * @type number
           */
          'cycles': 0,

          /**
           * The time taken to complete the deferred benchmark (secs).
           *
           * @memberOf Benchmark.Deferred
           * @type number
           */
          'elapsed': 0,

          /**
           * A timestamp of when the deferred benchmark started (ms).
           *
           * @memberOf Benchmark.Deferred
           * @type number
           */
          'timeStamp': 0
        });

        _.assign(Deferred.prototype, {
          'resolve': resolve
        });

        /*------------------------------------------------------------------------*/

        _.assign(Event.prototype, {

          /**
           * A flag to indicate if the emitters listener iteration is aborted.
           *
           * @memberOf Benchmark.Event
           * @type boolean
           */
          'aborted': false,

          /**
           * A flag to indicate if the default action is cancelled.
           *
           * @memberOf Benchmark.Event
           * @type boolean
           */
          'cancelled': false,

          /**
           * The object whose listeners are currently being processed.
           *
           * @memberOf Benchmark.Event
           * @type Object
           */
          'currentTarget': undefined$1,

          /**
           * The return value of the last executed listener.
           *
           * @memberOf Benchmark.Event
           * @type Mixed
           */
          'result': undefined$1,

          /**
           * The object to which the event was originally emitted.
           *
           * @memberOf Benchmark.Event
           * @type Object
           */
          'target': undefined$1,

          /**
           * A timestamp of when the event was created (ms).
           *
           * @memberOf Benchmark.Event
           * @type number
           */
          'timeStamp': 0,

          /**
           * The event type.
           *
           * @memberOf Benchmark.Event
           * @type string
           */
          'type': ''
        });

        /*------------------------------------------------------------------------*/

        /**
         * The default options copied by suite instances.
         *
         * @static
         * @memberOf Benchmark.Suite
         * @type Object
         */
        Suite.options = {

          /**
           * The name of the suite.
           *
           * @memberOf Benchmark.Suite.options
           * @type string
           */
          'name': undefined$1
        };

        /*------------------------------------------------------------------------*/

        _.assign(Suite.prototype, {

          /**
           * The number of benchmarks in the suite.
           *
           * @memberOf Benchmark.Suite
           * @type number
           */
          'length': 0,

          /**
           * A flag to indicate if the suite is aborted.
           *
           * @memberOf Benchmark.Suite
           * @type boolean
           */
          'aborted': false,

          /**
           * A flag to indicate if the suite is running.
           *
           * @memberOf Benchmark.Suite
           * @type boolean
           */
          'running': false
        });

        _.assign(Suite.prototype, {
          'abort': abortSuite,
          'add': add,
          'clone': cloneSuite,
          'emit': emit,
          'filter': filterSuite,
          'join': arrayRef.join,
          'listeners': listeners,
          'off': off,
          'on': on,
          'pop': arrayRef.pop,
          'push': push,
          'reset': resetSuite,
          'run': runSuite,
          'reverse': arrayRef.reverse,
          'shift': shift,
          'slice': slice,
          'sort': arrayRef.sort,
          'splice': arrayRef.splice,
          'unshift': unshift
        });

        /*------------------------------------------------------------------------*/

        // Expose Deferred, Event, and Suite.
        _.assign(Benchmark, {
          'Deferred': Deferred,
          'Event': Event,
          'Suite': Suite
        });

        /*------------------------------------------------------------------------*/

        // Add lodash methods as Suite methods.
        _.each(['each', 'forEach', 'indexOf', 'map', 'reduce'], function(methodName) {
          var func = _[methodName];
          Suite.prototype[methodName] = function() {
            var args = [this];
            push.apply(args, arguments);
            return func.apply(_, args);
          };
        });

        // Avoid array-like object bugs with `Array#shift` and `Array#splice`
        // in Firefox < 10 and IE < 9.
        _.each(['pop', 'shift', 'splice'], function(methodName) {
          var func = arrayRef[methodName];

          Suite.prototype[methodName] = function() {
            var value = this,
                result = func.apply(value, arguments);

            if (value.length === 0) {
              delete value[0];
            }
            return result;
          };
        });

        // Avoid buggy `Array#unshift` in IE < 8 which doesn't return the new
        // length of the array.
        Suite.prototype.unshift = function() {
          var value = this;
          unshift.apply(value, arguments);
          return value.length;
        };

        return Benchmark;
      }

      /*--------------------------------------------------------------------------*/

      // Export Benchmark.
      // Some AMD build optimizers, like r.js, check for condition patterns like the following:
      if (typeof define == 'function' && typeof define.amd == 'object' && define.amd) {
        // Define as an anonymous module so, through path mapping, it can be aliased.
        define(['lodash', 'platform'], function(_, platform) {
          return runInContext({
            '_': _,
            'platform': platform
          });
        });
      }
      else {
        var Benchmark = runInContext();

        // Check for `exports` after `define` in case a build optimizer adds an `exports` object.
        if (freeExports && freeModule) {
          // Export for Node.js.
          if (moduleExports) {
            (freeModule.exports = Benchmark).Benchmark = Benchmark;
          }
          // Export for CommonJS support.
          freeExports.Benchmark = Benchmark;
        }
        else {
          // Export to the global object.
          root.Benchmark = Benchmark;
        }
      }
    }.call(undefined));

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
        let metadata = await fetch(`../test/expected/${tile}.mlt.meta.pbf`);
        let mvtTile = await fetch(`../test/fixtures/${tile}.mvt`);
        let mltTile = await fetch(`../test/expected/${tile}.mlt`);
        const uri = tile.split('/')[1].split('-').map(Number);
        const { z, x, y } = { z: uri[0], x: uri[1], y: uri[2] };
        const tilesetMetadata = TileSetMetadata.fromBinary(metadata);
        return new Promise((resolve) => {
            const suite = new undefined;
            suite
                .on('cycle', function (event) {
                console.log(String(event.target));
            })
                .on('complete', () => {
                console.log('Fastest is ' + suite.filter('fastest').map('name'));
                resolve(null);
            })
                .add(`MLT ${tile}`, {
                defer: true,
                maxTime: maxTime,
                fn: (deferred) => {
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
                fn: (deferred) => {
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
        });
    };
    const runSuites = async (tiles) => {
        for (const tile of tiles) {
            await runSuite(tile);
        }
    };
    runSuites(tiles);

})();
