import {
  attribute, varying, Fn, normalView, vertexIndex,texture,
  float, vec3, color, clamp, max, step, mix, int, uv,
  positionLocal, transformNormalToView, uniform, vec2,
} from 'three/tsl';
import { MeshStandardNodeMaterial, DoubleSide } from 'three/webgpu';

const vHeight = varying(float());
const vNormal = varying(vec3());
const COLLECTION_COLORS =  [
  '#e3390a',  // Hot orange
  '#00D9ff',  // Electric Cyan
  '#FFD93D',  // Bright Yellow
  '#B84FFF',  // Vivid pinky
  '#959392',  // Deep Orange
  '#078216',  // Deep green
  '#4b0782',  // Deep purple
];
const BOARD_SIZE = 200;
const RESOLUTION = 64;

const MAX_TIMELINES = 16;
const bandUniforms = COLLECTION_COLORS.map(hex => uniform(color(hex)));

function bandColor(i) {
  // wrap if more bands than palette entries
  const idx = i % bandUniforms.length;
  return bandUniforms[idx];
}


export const getMat = (g) => {
  const redMat = new MeshStandardNodeMaterial({
    roughness: 0.4,
    metalness: 0.5,
    side: DoubleSide,
    transparent: false,
  });
  
  const numTimelines = g.userData.numTimelines -1 || 0;
  const maxHeight = float(g.userData.maxHeight || 1.0);
  const gridSize = uniform(g.userData.gridSize);
  const heightTexNode = texture(g.userData.heightTexture);
  const scale = uniform(1.0);
  


  // TIMELINE ATTRIBUTES - MAX IS 16 ///////////////////////////////////////
  // MUST BE EXPLICIT HENCE THE LIST OF CONSTs /////////////////////////////
  //////////////////////////////////////////////////////////////////////////
  const tl0  = attribute('timeline0');
  const tl1  = attribute('timeline1');
  const tl2  = attribute('timeline2');
  const tl3  = attribute('timeline3');
  const tl4  = attribute('timeline4');
  const tl5  = attribute('timeline5');
  const tl6  = attribute('timeline6');
  const tl7  = attribute('timeline7');
  const tl8  = attribute('timeline8');
  const tl9  = attribute('timeline9');
  const tl10 = attribute('timeline10');
  const tl11 = attribute('timeline11');
  const tl12 = attribute('timeline12');
  const tl13 = attribute('timeline13');
  const tl14 = attribute('timeline14');
  const tl15 = attribute('timeline15');

  function getTimeline(i) {
    switch (i) {
      case 0:  return tl0;
      case 1:  return tl1;
      case 2:  return tl2;
      case 3:  return tl3;
      case 4:  return tl4;
      case 5:  return tl5;
      case 6:  return tl6;
      case 7:  return tl7;
      case 8:  return tl8;
      case 9:  return tl9;
      case 10: return tl10;
      case 11: return tl11;
      case 12: return tl12;
      case 13: return tl13;
      case 14: return tl14;
      case 15: return tl15;
      default: return float(0.0);
    }
  }



//////////////////////////////////////////////////////////////////////////
// VERTEX: deform along Y using heightBuffer /////////////////////////////
//////////////////////////////////////////////////////////////////////////
  redMat.positionNode = Fn(() => {
  const position = positionLocal.xyz.toVar();
  const gridUV = uv();

  // sample center height from texture
  const offset   = float(1.0).div(gridSize);
  const centerH  = heightTexNode.sample(gridUV).r;

  // write height into Y (Y‑up)
  position.y.assign(centerH.mul(scale));
  vHeight.assign(centerH.mul(scale));

  // neighbours for normal
  const heightRight = heightTexNode.sample(gridUV.add(vec2(offset, 0.0))).r;
  const heightUp    = heightTexNode.sample(gridUV.add(vec2(0.0, offset))).r;

  const posRight = vec3(
    position.x.add(1.0),
    heightRight.mul(scale),   // Y
    position.z
  );
  const posUp = vec3(
    position.x,
    heightUp.mul(scale),      // Y
    position.z.add(1.0)
  );

  const edgeRight = posRight.sub(position);
  const edgeUp    = posUp.sub(position);
  //const normal    = edgeRight.cross(edgeUp).normalize();
  const normal = edgeUp.cross(edgeRight).normalize(); // swapped

  vNormal.assign(normal);

  return position;
})();


  //////////////////////////////////////////////////////////////////////////
  // NORMAL NODE ///////////////////////////////////////////////////////////
  //////////////////////////////////////////////////////////////////////////
  redMat.normalNode = transformNormalToView(vNormal);
// redMat.normalNode = vNormal; 

  //////////////////////////////////////////////////////////////////////////
  // COLOR NODE ////////////////////////////////////////////////////////////
  //////////////////////////////////////////////////////////////////////////
 redMat.colorNode = Fn(() => {

  const eps = float(1e-3);
  const h   = max(vHeight, eps);
  const hn  = clamp(h.div(maxHeight.add(eps)), 0.0, 1.0); // 0..1

  // 1) Early out if there are no real timelines (only date)
  if (numTimelines <= 1) {
    return bandColor(0);
  }

  //////////////////////////////////////////////////////////////////////
  // Per-vertex total over real timelines (1..numTimelines-1)
  //////////////////////////////////////////////////////////////////////
  let rawTotal = float(0.0);
  for (let i = 1; i < numTimelines; i++) {
    rawTotal = rawTotal.add(max(getTimeline(i), 0.0));
  }
  rawTotal = max(rawTotal, eps); // avoid div by zero

  //////////////////////////////////////////////////////////////////////
  // Accumulate normalized band fractions -> smoother bands
  //////////////////////////////////////////////////////////////////////
  let running  = float(0.0);
  let prevEdge = float(0.0);
  let colorOut = bandColor(0); // base color (background band)

  for (let i = 1; i < numTimelines; i++) {
    const bandValue = max(getTimeline(i), 0.0).div(rawTotal); // 0..1 share
    running = running.add(bandValue);

    const e = clamp(running, prevEdge, 1.0);
    prevEdge = e;

    const mask    = step(e, hn);      // 0 before edge i, 1 after
    const nextCol = bandColor(i);     // timeline i -> band i
    colorOut = mix(colorOut, nextCol, mask);
  }

  // Optional: prevent fully black when data is extremely sparse
  const minBrightness = float(0.15);
  colorOut = colorOut.max(minBrightness);

  return colorOut;

})();


  return redMat;
};
