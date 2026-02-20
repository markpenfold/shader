import { varying,cross,vec2,texture,float,floor, max, clamp,mx_noise_float, distance, exp,step, vec3, color, uniform, mix, uv, positionLocal, attribute,Fn,transformNormalToView } from 'three/tsl';
import { MeshSSSNodeMaterial, DoubleSide, Texture, MeshStandardNodeMaterial  } from 'three/webgpu';

const COLLECTION_COLORS =  [
  '#FF6B44',  // Hot Pink
  '#00D9ff',  // Electric Cyan
  '#FFD93D',  // Bright Yellow
  '#B84FFF',  // Vivid Purple
  '#959392',  // Deep Orange
];

/**
 g here is the geometry to be applied to
 */export const getMat = (g, hoverUV) => {
    // ... your validation code ...
    if (!g.userData.heightTexture || !g.userData.timelineTextures) {
            console.error('❌ Missing texture data!');
            return new MeshSSSNodeMaterial({ color: 0xff0000, side: DoubleSide });
        }
    console.log('🎨 Creating material for', g.userData.numTimelines, 'on g:', g);
    

    const redMat = new MeshStandardNodeMaterial({
    roughness: 0.4,
    metalness: 0.5,
    side: DoubleSide,
    transparent: false,
});

    const origin = COLLECTION_COLORS;
    const colors = origin.map(hex => uniform(color(hex)));
    const vUV = varying(vec2());
    const vHeight = varying(float());
    // Texture nodes
    const timelineTexNodes = g.userData.timelineTextures.map(tex => texture(tex));
    //const numTimelines = g.userData.numTimelines;
    const numTimelines = g.userData.numTimelines -1;

    // vertex stage
    redMat.positionNode = Fn(() => {
    const position = positionLocal.xyz.toVar();
    const gridUV = uv();

    vUV.assign(gridUV);        // allowed here
    vHeight.assign(position.y);

    return position;
    })();

redMat.colorNode = Fn(() => {
  const H = vHeight;
  const maxH = float(1.0); // or uniform if you know it
  const hNorm = clamp(H.div(maxH), 0.0, 1.0);
  return vec3(hNorm, hNorm, hNorm);
})();

    return redMat;
};