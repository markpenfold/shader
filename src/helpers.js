import * as THREE from 'three/webgpu';

export function aggregatedEventsToHeightArray(aggregatedEvents) {
   // console.log("agg events in aggregatedEventsToHeightArray", aggregatedEvents);
    if (!aggregatedEvents || aggregatedEvents.length === 0) return [];

    const heightArray = aggregatedEvents.map(composition =>
        composition.slice(1).reduce((sum, val) => sum + val, 0)    );
    return heightArray;
}


export function createTextureFromArray(dataArray) {
    
    const size = Math.sqrt(dataArray.length);
    const data = new Float32Array(dataArray);
    console.log("height texture size ", size);
    
    const texture = new THREE.DataTexture(
        data,
        size,
        size,
        THREE.RedFormat,
        THREE.FloatType
    );
    
    texture.needsUpdate = true;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    
    return texture;
}

export function logScaleHeights(heightArray, scale = 15) {
  const out = new Float32Array(heightArray.length);
  for (let i = 0; i < heightArray.length; i++) {
    const h = heightArray[i];
    out[i] = h > 0 ? Math.log(h + 1) * scale : 0;
  }
  return out;
}

export function blurHeights(srcArray, gridSize, iterations = 1) {
  const len = srcArray.length;
  const src = new Float32Array(srcArray);      // work on a copy
  const tmp = new Float32Array(len);

  for (let it = 0; it < iterations; it++) {
    for (let y = 0; y < gridSize; y++) {
      for (let x = 0; x < gridSize; x++) {
        let sum = 0;
        let count = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const nx = x + dx;
            const ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= gridSize || ny >= gridSize) continue;
            sum += src[ny * gridSize + nx];
            count++;
          }
        }
        const center = src[y * gridSize + x];
        const neighbourAvg = sum / count;

        // 0.7 keeps 70% original shape, 30% blur – tweak to taste
        const preserve = 0.8;
        tmp[y * gridSize + x] = center * preserve + neighbourAvg * (1.0 - preserve);
      }
    }
    src.set(tmp);
  }

  return src;
}

export function updatePlane9(geo, aggregatedEvents, curve_points = 64) {
  const MAX_TIMELINES = 16;

  if (!aggregatedEvents || aggregatedEvents.length === 0) {
    geo.userData.numTimelines = 0;
    geo.userData.maxHeight = 0;
    geo.userData.minHeight = 0;

    // still ensure attributes exist (all zero) so shader is happy
    const vertexCount = geo.attributes.position.count;
    const zeroBuf = new Float32Array(vertexCount);
    for (let t = 0; t < MAX_TIMELINES; t++) {
      geo.setAttribute(
        `timeline${t}`,
        new THREE.Float32BufferAttribute(zeroBuf, 1)
      );
    }
    return geo;
  }

  let numTimelines = aggregatedEvents[0].length;
  const vertexCount = geo.attributes.position.count; 

  if (aggregatedEvents.length !== vertexCount) {
    console.warn('aggregatedEvents length must equal vertex count');
  }

  // clamp to MAX_TIMELINES so shader and geometry agree
  if (numTimelines > MAX_TIMELINES) {
    console.warn(
      `numTimelines (${numTimelines}) > MAX_TIMELINES (${MAX_TIMELINES}), truncating`
    );
    numTimelines = MAX_TIMELINES;
  }

  // heights
  const heightArray = aggregatedEventsToHeightArray(aggregatedEvents);
  const gridSize = Math.sqrt(heightArray.length);
  const logHeights = logScaleHeights(heightArray);
  const blurH = blurHeights(logHeights, gridSize, 1);


  const heightTexture = createTextureFromArray(blurH);
  
  

  const heights = new Float32Array(vertexCount);
  let maxHeight = -Infinity;
  let minHeight = Infinity;

  for (let i = 0; i < vertexCount; i++) {
    const h = blurH[i] ?? 0;
    heights[i] = h;
    if (h > maxHeight) maxHeight = h;
    if (h < minHeight) minHeight = h;
  }


  // per‑timeline attributes: always create timeline0..timeline15
  for (let t = 0; t < MAX_TIMELINES; t++) {
    const buf = new Float32Array(vertexCount);

    if (t < numTimelines) {
      // real data for used timelines
      for (let v = 0; v < vertexCount; v++) {
        const row = aggregatedEvents[v] || [];
        buf[v] = row[t] ?? 0;
      }
    } else {
      // unused timelines remain all zeros
      buf.fill(0);
    }

    geo.setAttribute(
      `timeline${t}`,
      new THREE.Float32BufferAttribute(buf, 1)
    );
  }

  geo.userData.heightTexture = heightTexture;
  geo.userData.numTimelines = numTimelines;
  geo.userData.maxHeight = maxHeight;
  geo.userData.minHeight = minHeight;
  geo.userData.maxTimelines = MAX_TIMELINES;
  geo.userData.gridSize = Math.sqrt(aggregatedEvents.length);

  //console.log('✅ updatePlane9 buffers ready, mofo', geo);
  return geo;
}




// generates mesh from height maps
function getSmoothArray(hmap, curve_points) {
    //console.log("hfuckingmap:", hmap);
    var splines2 = get_z_splines(hmap, curve_points);
    //console.log('splines 2:', splines2);
    var hArray = getHeightArray(splines2, curve_points);
    return hArray;
}

export function heightArrayToSmoothMatrix(heightArray) {
    //console.log('height array:', heightArray);
    const gridSize = Math.sqrt(heightArray.length);
    const matrix = [];
    
    for (let row = 0; row < gridSize; row++) {
        const rowVectors = [];
        for (let col = 0; col < gridSize; col++) {
            const index = row * gridSize + col;
            const height = heightArray[index] > 0 ? Math.log(heightArray[index] + 1) * 15 : 0;
            // Vector2(x_position, height_value)
            rowVectors.push(new THREE.Vector2(col, height));
        }
        matrix.push(rowVectors);
    }
    
    return matrix;
}

//generate array of splines from h_matrix of vec2s
export function get_x_splines(hMap){
    //console.log("MAPPY:", hMap.length);
    try{
        let splines = [];
        let len = hMap.length;
    
        for(let i=0; i<len; i++){
            splines.push(new THREE.SplineCurve(hMap[i]));
        }
        return splines;
    } catch (error) {
        console.error(error);
      }
}

//generate array of splines from h_matrix of vec2s
export function get_z_splines(hMap, curve_points=64){
    //console.log("Hmap: ", hMap);
    var xSplines = get_x_splines(hMap);
    var zSplines = [];
    const long_lines = [];
    var temp = [];
    var temp2 = [];
    var temp3 = [];
    try{
        for(var x=0; x<xSplines.length; x++){
            var points_n = xSplines[x].getPoints( curve_points-1 );
            long_lines.push(points_n);
        }

        for(var b=0;  b<long_lines[0].length; b++) {
            for(var a=0;  a<xSplines.length; a++){
               temp.push(new THREE.Vector2( a,long_lines[a][b].y ));
            }

            zSplines.push(new THREE.SplineCurve(temp));
            temp = [];
        }
        return zSplines;
        
    } catch (error) {
        console.log(error);
      }
}

export function getHeightArray(splines, curve_points){
    const heightArray = new Array(curve_points * curve_points);
    
    // Iterate through each spline (column)
    for(var col = 0; col < splines.length; col++){
        var points = splines[col].getPoints(curve_points - 1);
        
        // For each point in this column
        for(var row = 0; row < points.length; row++){
            // Write to row-major position: row * width + col
            const index = row * curve_points + col;
            if(points[row].y < 0){
                points[row].y = 0;
            }
            heightArray[index] = points[row].y;
        }
    }
    
    return heightArray;
}


export function handleCurves(curveArray, curve_points, dimension){
    var heightArray2 = new Array();
    for(let a=0; a<curveArray.length; a++){
        const points = curveArray[a].getPoints( curve_points );
        for(var i=0; i<points.length; i++){
            heightArray2.push(points[i].y);
        }
    }
    //console.log("points:", heightArray2.length);
    return heightArray2;
}






























