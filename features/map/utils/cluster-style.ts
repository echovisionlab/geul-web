const MOBILE_CLUSTER_WIDTH_PX = 480;
const TABLET_CLUSTER_WIDTH_PX = 768;

export interface ClusterLayerSizing {
  circleRadii: [number, number, number, number];
  textSizes: [number, number, number, number];
}

const DESKTOP_CLUSTER_LAYER_SIZING: ClusterLayerSizing = {
  circleRadii: [52, 64, 78, 94],
  textSizes: [13, 14, 15, 16],
};

function scaleTuple(
  values: [number, number, number, number],
  scale: number,
  minimums: [number, number, number, number],
): [number, number, number, number] {
  return values.map((value, index) => Math.max(minimums[index]!, Math.round(value * scale))) as [
    number,
    number,
    number,
    number,
  ];
}

export function getClusterLayerSizing(containerWidth: number): ClusterLayerSizing {
  if (containerWidth <= MOBILE_CLUSTER_WIDTH_PX) {
    return {
      circleRadii: scaleTuple(DESKTOP_CLUSTER_LAYER_SIZING.circleRadii, 0.72, [36, 44, 54, 66]),
      textSizes: scaleTuple(DESKTOP_CLUSTER_LAYER_SIZING.textSizes, 0.92, [12, 13, 14, 15]),
    };
  }

  if (containerWidth <= TABLET_CLUSTER_WIDTH_PX) {
    return {
      circleRadii: scaleTuple(DESKTOP_CLUSTER_LAYER_SIZING.circleRadii, 0.86, [44, 54, 66, 80]),
      textSizes: scaleTuple(DESKTOP_CLUSTER_LAYER_SIZING.textSizes, 0.96, [12, 13, 14, 15]),
    };
  }

  return DESKTOP_CLUSTER_LAYER_SIZING;
}
