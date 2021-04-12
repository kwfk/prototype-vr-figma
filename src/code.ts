import { ExportableBytes, Hotspot, Frame, ExportJSON } from "./interface";

const { children, prototypeStartNode: startingFrame } = figma.currentPage;

function hasValidSelection(nodes) {
  return !(!nodes || nodes.length === 0);
}

function findReactionNodes(node: BaseNode): Hotspot[] {
  let ret: Hotspot[] = [];
  if ("reactions" in node && node.reactions.length > 0) {
    ret = [
      {
        name: node.name,
        id: node.id,
        x: node.x,
        y: node.y,
        w: node.width,
        h: node.height,
        visible: node.opacity !== 0,
        action: node.reactions.map((react) => {
          if (react.action.type === "NODE") {
            return {
              type: react.action.type,
              destinationId: react.action.destinationId,
              transition: react.action.transition,
              trigger: react.trigger,
            };
          }
          return {
            type: react.action.type,
            trigger: react.trigger,
          };
        }),
      },
    ];
  }
  if ("children" in node) {
    if (node.type !== "INSTANCE") {
      for (const child of node.children) {
        ret = [...ret, ...findReactionNodes(child)];
      }
    }
  }
  return ret;
}

async function main(nodes: readonly SceneNode[]): Promise<string> {
  if (!hasValidSelection(children))
    return Promise.resolve("Nothing prototyped for export");

  let exportableBytes: ExportableBytes[] = [];
  let frameDetails: Frame[] = [];
  for (let node of nodes) {
    let { id, name, width, height, exportSettings } = node;

    frameDetails.push({
      id,
      name,
      width,
      height,
      hotspots: findReactionNodes(node),
    });

    // Should we force to use PNG or use the export setting?
    // if (exportSettings.length === 0) {
    const setting: ExportSettings = {
      format: "PNG",
      suffix: "",
      constraint: { type: "SCALE", value: 1 },
      contentsOnly: true,
    };
    // }

    // for (let setting of exportSettings) {
    // let defaultSetting = setting;
    const bytes = await node.exportAsync(setting);
    exportableBytes.push({
      id,
      name,
      setting,
      bytes,
    });
    // }
  }

  const exportJSON: ExportJSON = {
    startingFrame: startingFrame.name,
    frames: frameDetails,
  };

  figma.showUI(__html__);
  figma.ui.resize(472, 328);
  figma.ui.postMessage({
    exportableBytes,
    exportJSON,
    projectName: figma.root.name,
    pageName: figma.currentPage.name,
  });

  return new Promise((resolve) => {
    figma.ui.onmessage = ({ type }) => {
      if (type === "zip-success") resolve("Exported!");
    };
  });
}

main(children).then((res) => figma.closePlugin(res));
