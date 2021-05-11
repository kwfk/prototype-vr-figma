import { getFrameName } from "./getFrameName";
import {
  ExportableBytes,
  Hotspot,
  Frame,
  ExportJSON,
  ErrorNode,
} from "./interface";

const { children, prototypeStartNode: startingFrame } = figma.currentPage;

function hasValidSelection(nodes) {
  return !(!nodes || nodes.length === 0);
}

let errorNodes: ErrorNode[] = [];

function findReactionNodes(
  node: BaseNode,
  usedNames: Record<string, { id: string; index: number; pathname: string }>,
  pathname: string
): Hotspot[] {
  let ret: Hotspot[] = [];
  const { name } = node;
  const currPathname = pathname ? `${pathname} > ${name}` : name;
  if ("reactions" in node && node.reactions.length > 0) {
    const { id, x, y, width, height, opacity, reactions } = node;
    if (usedNames[name] !== undefined) {
      const { id: initialId, pathname: initialPath, index } = usedNames[name];
      if (index == -1) {
        const len = errorNodes.push({
          type: "DUPLICATE_HOTSPOT",
          name,
          duplicates: [
            { id: initialId, pathname: initialPath },
            { id, pathname: currPathname },
          ],
        });
        usedNames[name].index = len - 1;
      } else {
        const error = errorNodes[usedNames[name].index];
        if (error.type === "DUPLICATE_HOTSPOT")
          error.duplicates.push({ id, pathname: currPathname });
      }
    } else {
      usedNames[name] = {
        id,
        pathname: currPathname,
        index: -1,
      };
    }

    ret = [
      {
        name,
        id,
        x,
        y,
        w: width,
        h: height,
        visible: opacity !== 0,
        action: reactions.map((react) => {
          if (react.action.type === "NODE") {
            if (react.action.transition?.type === "SMART_ANIMATE") {
              const { id, name } = node;
              errorNodes.push({
                type: "UNSUPPORTED ACTION: SMART_ANIMATE",
                id,
                name,
                pathname: currPathname,
                trigger: react.trigger.type,
              });
            }
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
        ret = [...ret, ...findReactionNodes(child, usedNames, currPathname)];
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

    let usedNames: Record<
      string,
      { id: string; index: number; pathname: string }
    > = {};
    frameDetails.push({
      id,
      name: getFrameName(name, id),
      width,
      height,
      hotspots: findReactionNodes(node, usedNames, ""),
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
    startingFrame: startingFrame?.name,
    frames: frameDetails,
  };

  figma.showUI(__html__);
  figma.ui.resize(372, 328);
  figma.ui.postMessage({
    exportableBytes,
    exportJSON,
    errorNodes: errorNodes,
    projectName: figma.root.name,
    pageName: figma.currentPage.name,
  });

  return new Promise((resolve) => {
    figma.ui.onmessage = (msg) => {
      const { type } = msg;
      if (type === "zip-success") resolve("Exported!");
      if (type === "select-click") {
        const ids: string[] = msg.ids;
        const nodes = ids.map((id) => {
          const node = figma.getNodeById(id);
          if (node.type !== "DOCUMENT" && node.type !== "PAGE") {
            return node;
          }
        });
        figma.currentPage.selection = nodes;
        figma.viewport.scrollAndZoomIntoView(nodes);
      }
    };
  });
}

main(children).then((res) => figma.closePlugin(res));
