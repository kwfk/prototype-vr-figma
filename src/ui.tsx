import * as React from "react";
import * as ReactDOM from "react-dom";
import "./ui.css";
import JSZip from "../node_modules/jszip/dist/jszip.min.js";
import { ExportableBytes, ExportJSON, ErrorNode } from "./interface";
import { getFrameName } from "./getFrameName";

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
  const [selectedNode, setSelectedNode] = React.useState("");

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
        const { id, bytes, name, setting } = data;

        const blob = blobify(bytes, setting.format);

        const extension = exportTypeToFileExtension(setting.format);
        const filename = `${getFrameName(name, id)}${
          setting.suffix
        }${extension}`;
        zip.file(filename, blob, {
          base64: true,
        });
        manifest.screenImages = [...manifest.screenImages, filename];
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
        {errorNodes.length > 0 ? (
          <>
            <h3 className="section item header">Warnings</h3>
            <div className="section">
              {errorNodes.map((error, index) => {
                if (error.type === "UNSUPPORTED ACTION: SMART_ANIMATE") {
                  const { id, trigger, pathname } = error;
                  return (
                    <div
                      key={index}
                      className={`item-container ${
                        index.toString() === selectedNode
                          ? "item-container-selected"
                          : ""
                      }`}
                      onClick={() => {
                        setSelectedNode(index.toString());
                        window.parent.postMessage(
                          {
                            pluginMessage: { type: "select-click", ids: [id] },
                          },
                          "*"
                        );
                      }}
                    >
                      <div
                        className={`item item-title ${
                          index.toString() === selectedNode
                            ? "item-title-selected"
                            : "item-title-hover"
                        }`}
                      >
                        {error.type}
                      </div>
                      <div className="item item-details">
                        <div>
                          <span className="item-detail-label">Node</span>
                          {error.pathname}
                        </div>
                        <div>
                          <span className="item-detail-label">Trigger</span>
                          {trigger}
                        </div>
                      </div>
                    </div>
                  );
                } else if (error.type === "DUPLICATE_HOTSPOT") {
                  const { duplicates } = error;
                  return (
                    <div
                      className={`item-container ${
                        index.toString() === selectedNode
                          ? "item-container-selected"
                          : ""
                      }`}
                      key={index}
                    >
                      <div
                        className={`item item-title ${
                          index.toString() === selectedNode
                            ? "item-title-selected"
                            : "item-title-hover"
                        }`}
                        onClick={() => {
                          setSelectedNode(index.toString());
                          window.parent.postMessage(
                            {
                              pluginMessage: {
                                type: "select-click",
                                ids: duplicates.map(({ id }) => id),
                              },
                            },
                            "*"
                          );
                        }}
                      >
                        {error.type}: {error.name}
                      </div>
                      {duplicates.map(({ id, pathname }, idIndex) => (
                        <div
                          key={id}
                          className={`item item-details item-details-clickable ${
                            `${index}:${idIndex}` === selectedNode
                              ? "item-details-selected"
                              : "item-details-hover"
                          }`}
                          onClick={() => {
                            setSelectedNode(`${index}:${idIndex}`);
                            window.parent.postMessage(
                              {
                                pluginMessage: {
                                  type: "select-click",
                                  ids: [id],
                                },
                              },
                              "*"
                            );
                          }}
                        >
                          <span className="item-detail-label">{id}</span>
                          {pathname}
                        </div>
                      ))}
                    </div>
                  );
                }
              })}
            </div>
          </>
        ) : null}
        <h3 className="section item header">Export Preview</h3>
        <div className="item preview-section">
          {exportableBytes.map((data, index) => {
            const { id, bytes, name, setting } = data;
            const blob = blobify(bytes, setting.format);
            const objURL = URL.createObjectURL(blob);
            return (
              <div
                className="preview-container"
                key={id}
                onClick={() => {
                  setSelectedNode(`preview:${index}`);
                  window.parent.postMessage(
                    { pluginMessage: { type: "select-click", ids: [id] } },
                    "*"
                  );
                }}
              >
                <div
                  className={`preview ${
                    `preview:${index}` === selectedNode
                      ? "preview-selected"
                      : ""
                  }`}
                >
                  <div
                    className="preview-img"
                    style={{ backgroundImage: `url(${objURL})` }}
                  />
                </div>
                <div
                  className={`preview-text ${
                    `preview:${index}` === selectedNode
                      ? "preview-text-selected"
                      : ""
                  }`}
                >
                  {getFrameName(name, id)}
                </div>
              </div>
            );
          })}
        </div>
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
