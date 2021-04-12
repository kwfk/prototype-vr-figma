export interface ExportableBytes {
  name: string;
  setting: ExportSettingsImage | ExportSettingsPDF | ExportSettingsSVG;
  bytes: Uint8Array;
}

export type Hotspot = {
  name: string;
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  visible: boolean;
  action: {
    type: string;
    destinationId?: string | null;
    transition?: Transition;
    trigger: Trigger;
  }[];
};

export type Frame = {
  id: string;
  name: string;
  width: number;
  height: number;
  hotspots: Hotspot[];
};

export type ExportJSON = {
  startingFrame: string;
  frames: Frame[];
};
