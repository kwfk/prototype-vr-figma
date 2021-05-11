import * as React from "react";
import * as ReactDOM from "react-dom";
import "./ui.css";
import JSZip from "../node_modules/jszip/dist/jszip.min.js";
import { ExportableBytes, ExportJSON, ErrorNode } from "./interface";

declare function require(path: string): any;
const FIGMA_JSON_NAME = "interface";

const App: React.FC = () => {
  const [exportableBytes, setExportableBytes] = React.useState<
    ExportableBytes[]
  >([]);
  const [exportJSON, setExportJSON] = React.useState<ExportJSON>();
  const [errorNodes, setErrorNodes] = React.useState<ErrorNode[]>([]);
  const [projectName, setProjectName] = React.useState("");
  const [pageName, setPageName] = React.useState("");
  const [selectedNode, setSelectedNode] = React.useState(-1);

  const [selectedFrames, setSelectedFrames] = React.useState<string[]>([]);
  textbox: HTMLInputElement;

  const typedArrayToBuffer = (array) => {
    return array.buffer.slice(
      array.byteOffset,
      array.byteLength + array.byteOffset
    );
  };

  const exportTypeToBlobType = (type: string) => {
    switch (type) {
      case "PDF":
        return "application/pdf";
      case "SVG":
        return "image/svg+xml";
      case "PNG":
        return "image/png";
      case "JPG":
        return "image/jpeg";
      case "JSON":
        return "application/json";
      default:
        return "image/png";
    }
  };

  const exportTypeToFileExtension = (type: string) => {
    switch (type) {
      case "PDF":
        return ".pdf";
      case "SVG":
        return ".svg";
      case "PNG":
        return ".png";
      case "JPG":
        return ".jpg";
      case "JSON":
        return ".json";
      default:
        return ".png";
    }
  };

  window.onmessage = (event) => {
    if (!event.data.pluginMessage) return;

    const {
      exportableBytes,
      exportJSON,
      errorNodes,
      projectName,
      pageName,
    } = event.data.pluginMessage;

    console.log(errorNodes);

    setExportableBytes(exportableBytes);
    setExportJSON(exportJSON);
    setErrorNodes(errorNodes);
    setProjectName(projectName);
    setPageName(pageName);
  };

  const blobify = (
    bytes: Uint8Array,
    format: "JPG" | "PNG" | "PDF" | "SVG"
  ) => {
    const cleanBytes = typedArrayToBuffer(bytes);
    const type = exportTypeToBlobType(format);
    const blob = new Blob([cleanBytes], { type });
    return blob;
  };

  const handleExport = async () => {
    return new Promise<void>((resolve) => {
      let zip = new JSZip();
      let manifest = { figmaJson: `${FIGMA_JSON_NAME}.json`, screenImages: [] };

      // Export JSON details
      const json = JSON.stringify(exportJSON, null, 2);
      let jsonblob = new Blob([json], { type: exportTypeToBlobType("JSON") });
      zip.file(`${FIGMA_JSON_NAME}.json`, jsonblob, { base64: true });

      // Export frame images
      for (let data of exportableBytes) {
        const { bytes, name, setting } = data;

        const blob = blobify(bytes, setting.format);

        const extension = exportTypeToFileExtension(setting.format);
        zip.file(`${name}${setting.suffix}${extension}`, blob, {
          base64: true,
        });
        manifest.screenImages = [
          ...manifest.screenImages,
          `${name}${setting.suffix}${extension}`,
        ];
      }

      // Export manifest JSON
      const manifestJSON = JSON.stringify(manifest, null, 2);
      let manifestBlob = new Blob([manifestJSON], {
        type: exportTypeToBlobType("JSON"),
      });
      zip.file(`manifest.json`, manifestBlob, { base64: true });

      // Zip files
      zip.generateAsync({ type: "blob" }).then((content: Blob) => {
        const blobURL = window.URL.createObjectURL(content);
        const link = document.createElement("a");
        link.className = "button button--primary";
        link.href = blobURL;
        link.download = `${projectName}.fig2u`;
        link.click();
        link.setAttribute("download", "download");
        resolve();
      });
    }).then(() => {
      window.parent.postMessage(
        { pluginMessage: { type: "zip-success" } },
        "*"
      );
    });
  };

  return (
    <div id="app">
      <div id="content">
        {errorNodes.map((error, index) => {
          if (error.type === "UNSUPPORTED ACTION: SMART_ANIMATE") {
            const { id, trigger } = error;
            return (
              <div
                className={`item-container ${
                  index === selectedNode ? "item-container-selected" : null
                }`}
                key={index}
              >
                <div
                  onClick={() => {
                    setSelectedNode(index);
                    window.parent.postMessage(
                      { pluginMessage: { type: "error-click", ids: [id] } },
                      "*"
                    );
                  }}
                >
                  <div
                    className={`item item-title ${
                      index === selectedNode
                        ? "item-title-selected"
                        : "item-title-hover"
                    }`}
                  >
                    {error.type}
                  </div>
                  <div className="item item-details">
                    <div>{`Node: ${error.name}`}</div>
                    <div>{`Trigger: ${trigger}`}</div>
                  </div>
                </div>
              </div>
            );
          } else if (error.type === "DUPLICATE_HOTSPOT") {
            const { ids } = error;
            return (
              <div
                className={`item-container ${
                  index === selectedNode ? "item-container-selected" : null
                }`}
                key={index}
              >
                <div
                  onClick={() => {
                    setSelectedNode(index);
                    window.parent.postMessage(
                      { pluginMessage: { type: "error-click", ids } },
                      "*"
                    );
                  }}
                >
                  <div
                    className={`item item-title ${
                      index === selectedNode
                        ? "item-title-selected"
                        : "item-title-hover"
                    }`}
                  >
                    {error.type}: {error.name}
                  </div>
                  {ids.map((id) => (
                    <div key={id} className="item item-details">
                      {id}
                    </div>
                  ))}
                </div>
              </div>
            );
          }
        })}
        {/* {exportableBytes.map((data) => {
          const { id, bytes, name, setting } = data;
          const blob = blobify(bytes, setting.format);
          const objURL = URL.createObjectURL(blob);
          return (
            <div className="preview-container" key={id}>
              <div className={`preview`}>
                <div
                  className="preview-img"
                  style={{ backgroundImage: `url(${objURL})` }}
                />
              </div>
              <div className="preview-text">{name}</div>
            </div>
          );
        })} */}
      </div>
      <footer>
        <button id="create" onClick={handleExport}>
          Export
        </button>
      </footer>
    </div>
  );
};

ReactDOM.render(<App />, document.getElementById("root"));
