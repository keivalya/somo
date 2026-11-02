export type EmotionId = 'curious' | 'joyful' | 'empathetic' | 'focused' | 'restful';

export interface EmotionPreset {
  id: EmotionId;
  label: string;
  tagline: string;
  actuatorLiftCm: number;
  headTiltDeg: number;
  eyeColor: string;
  accentColor: string;
  eyeShape: 'round' | 'happy-arc' | 'soft-warm' | 'scan-ring' | 'sleep-blink';
  chestScreenStatus: string;
  chestWaveform: string;
  description: string;
}

export const EMOTION_PRESETS: EmotionPreset[] = [
  {
    id: 'curious',
    label: 'Curious',
    tagline: 'Gaze tracking • Elevated head',
    actuatorLiftCm: 1.8,
    headTiltDeg: -6,
    eyeColor: '#38bdf8',
    accentColor: '#f59e0b',
    eyeShape: 'round',
    chestScreenStatus: 'LISTENING',
    chestWaveform: '24-bit I2S',
    description: 'Active binocular eye tracking with 18mm actuator lift.',
  },
  {
    id: 'joyful',
    label: 'Joyful',
    tagline: 'Full lift • Warm eye arcs',
    actuatorLiftCm: 2.6,
    headTiltDeg: -10,
    eyeColor: '#fbbf24',
    accentColor: '#fbbf24',
    eyeShape: 'happy-arc',
    chestScreenStatus: 'RESONANCE',
    chestWaveform: 'Warm chime',
    description: 'Full 26mm head elevation and golden crescent eyes.',
  },
  {
    id: 'empathetic',
    label: 'Calm',
    tagline: 'Soft posture • Gentle tilt',
    actuatorLiftCm: 0.4,
    headTiltDeg: 7,
    eyeColor: '#fb7185',
    accentColor: '#f43f5e',
    eyeShape: 'soft-warm',
    chestScreenStatus: 'QUIET PRESENCE',
    chestWaveform: '6 breaths/min',
    description: 'Low, gentle forward tilt for calm companionship.',
  },
  {
    id: 'focused',
    label: 'Focus',
    tagline: 'Level horizon • Optical scan',
    actuatorLiftCm: 1.2,
    headTiltDeg: 0,
    eyeColor: '#34d399',
    accentColor: '#10b981',
    eyeShape: 'scan-ring',
    chestScreenStatus: 'RPi5 VISION',
    chestWaveform: 'On-device AI',
    description: 'Local scene analysis via Arducam B0332 and Raspberry Pi 5.',
  },
  {
    id: 'restful',
    label: 'Rest',
    tagline: 'Dome retracted • Standby',
    actuatorLiftCm: -1.4,
    headTiltDeg: 10,
    eyeColor: '#a78bfa',
    accentColor: '#8b5cf6',
    eyeShape: 'sleep-blink',
    chestScreenStatus: 'STANDBY',
    chestWaveform: 'Mic muted',
    description: 'Head dome retracted flush with the collar ring.',
  },
];

export interface AssemblyPartMeta {
  nodeName: string;
  title: string;
  category: 'shell' | 'head' | 'display' | 'sensor' | 'actuation' | 'compute';
  f3dSource: string;
  explodeVector: [number, number, number];
  calloutPos: [number, number, number];
  specs: string;
  description: string;
}

export const ASSEMBLY_PARTS: Record<string, AssemblyPartMeta> = {
  Head_Dome_Cap: {
    nodeName: 'Head_Dome_Cap',
    title: 'Touch Dome Cap',
    category: 'head',
    f3dSource: 'iro_v2/2c8e076d.f3d',
    explodeVector: [0, 14, 0],
    calloutPos: [0, 24.5, 0],
    specs: 'Ø 136.6 mm • Cream ABS',
    description: 'Capacitive crown cap.',
  },
  Head_Dome_Amber: {
    nodeName: 'Head_Dome_Amber',
    title: 'Upper Head Dome',
    category: 'head',
    f3dSource: 'iro_v2/165d2249.f3d',
    explodeVector: [0, 9.5, 0],
    calloutPos: [6.5, 20.5, 4.5],
    specs: 'Ø 185.2 mm • Amber Gold',
    description: 'Actuated upper head shell.',
  },
  Head_Neck_Visor: {
    nodeName: 'Head_Neck_Visor',
    title: 'Binocular Eye Visor',
    category: 'head',
    f3dSource: 'iro_v2/2c8e076d.f3d',
    explodeVector: [0, 6.0, 3.5],
    calloutPos: [0, 14.5, 8.2],
    specs: 'Dual Ø 32.5 mm Sockets',
    description: 'Recessed binocular neck housing.',
  },
  Eye_Left_GC9A01: {
    nodeName: 'Eye_Left_GC9A01',
    title: 'Left Eye • GC9A01',
    category: 'display',
    f3dSource: 'iro_v2/eb39b3f2.zip.f3d',
    explodeVector: [-4.5, 6.0, 9.5],
    calloutPos: [-2.5, 14.8, 7.2],
    specs: '1.28" 240×240 IPS SPI',
    description: 'Round IPS eye display.',
  },
  Eye_Right_GC9A01: {
    nodeName: 'Eye_Right_GC9A01',
    title: 'Right Eye • GC9A01',
    category: 'display',
    f3dSource: 'iro_v2/eb39b3f2.zip.f3d',
    explodeVector: [4.5, 6.0, 9.5],
    calloutPos: [2.5, 14.8, 7.2],
    specs: '1.28" 240×240 IPS SPI',
    description: 'Round IPS eye display.',
  },
  Shell_Main_Amber: {
    nodeName: 'Shell_Main_Amber',
    title: '4-Arch Monocoque',
    category: 'shell',
    f3dSource: 'iro_v2/165d2249.f3d',
    explodeVector: [0, 1.5, 0],
    calloutPos: [8.2, 11.5, 8.2],
    specs: '220 × 220 × 174 mm',
    description: 'Primary four-arch body shell.',
  },
  Panel_Front_Cream: {
    nodeName: 'Panel_Front_Cream',
    title: 'Front Sensor Panel',
    category: 'shell',
    f3dSource: 'iro_v2/165d2249.f3d',
    explodeVector: [0, 0, 12.5],
    calloutPos: [-5.5, 6.5, 12.8],
    specs: 'Camera, Mic & TFT Bezel',
    description: 'Front arch panel.',
  },
  Panel_Left_Cream: {
    nodeName: 'Panel_Left_Cream',
    title: 'Left Arch Panel',
    category: 'shell',
    f3dSource: 'iro_v2/165d2249.f3d',
    explodeVector: [-12.5, 0, 0],
    calloutPos: [-12.8, 6.5, 0],
    specs: 'Warm Cream ABS',
    description: 'Left acoustic arch panel.',
  },
  Panel_Right_Cream: {
    nodeName: 'Panel_Right_Cream',
    title: 'Right Arch Panel',
    category: 'shell',
    f3dSource: 'iro_v2/165d2249.f3d',
    explodeVector: [12.5, 0, 0],
    calloutPos: [12.8, 6.5, 0],
    specs: 'Warm Cream ABS',
    description: 'Right acoustic arch panel.',
  },
  Panel_Back_Cream: {
    nodeName: 'Panel_Back_Cream',
    title: 'Rear I/O Panel',
    category: 'shell',
    f3dSource: 'iro_v2/165d2249.f3d',
    explodeVector: [0, 0, -12.5],
    calloutPos: [0, 6.5, -12.8],
    specs: 'Power Pass-Through',
    description: 'Rear enclosure panel.',
  },
  Sensor_Camera_Arducam: {
    nodeName: 'Sensor_Camera_Arducam',
    title: 'Arducam B0332',
    category: 'sensor',
    f3dSource: 'iro_v2/7fcd840a.zip.f3d',
    explodeVector: [0, 1.5, 7.5],
    calloutPos: [0, 10.7, 12.8],
    specs: 'Wide-Angle M12 CSI-2',
    description: 'Upward-angled optical vision sensor.',
  },
  Sensor_Mic_INMP441: {
    nodeName: 'Sensor_Mic_INMP441',
    title: 'INMP441 Mic',
    category: 'sensor',
    f3dSource: 'iro_v2/9b94f29b.zip.f3d',
    explodeVector: [3.5, 1.0, 8.0],
    calloutPos: [2.95, 9.5, 12.1],
    specs: '24-bit Digital I2S MEMS',
    description: 'Omnidirectional microphone.',
  },
  Screen_Chest_TFT: {
    nodeName: 'Screen_Chest_TFT',
    title: 'FeatherWing 2.4" TFT',
    category: 'display',
    f3dSource: 'iro_v2/6727d270.zip.f3d',
    explodeVector: [0, -1.0, 7.5],
    calloutPos: [0.2, 5.9, 11.2],
    specs: '320×240 Color Touch',
    description: 'Chest status display.',
  },
  Drive_Linear_Actuator: {
    nodeName: 'Drive_Linear_Actuator',
    title: 'Linear Actuator',
    category: 'actuation',
    f3dSource: 'iro_v2/f3f598f1.f3d',
    explodeVector: [0, 4.0, 0],
    calloutPos: [0, 11.5, 0],
    specs: '50 mm Stroke Column',
    description: 'Telescoping neck lift drive.',
  },
  Compute_Raspberry_Pi_5: {
    nodeName: 'Compute_Raspberry_Pi_5',
    title: 'Raspberry Pi 5',
    category: 'compute',
    f3dSource: 'iro_v2/5613be21.zip.f3d',
    explodeVector: [0, -4.5, -6.0],
    calloutPos: [0, 2.5, -5.5],
    specs: 'BCM2712 Quad-Core 2.4GHz',
    description: 'Local on-device compute core.',
  },
  Internal_Chassis: {
    nodeName: 'Internal_Chassis',
    title: 'Internal Chassis',
    category: 'actuation',
    f3dSource: 'iro_v2/2c8e076d.f3d',
    explodeVector: [0, -6.5, 0],
    calloutPos: [0, 0.5, 0],
    specs: 'Ø 250 mm Vented Base',
    description: 'Structural frame and base plate.',
  },
};

export interface CadFileEntry {
  id: string;
  friendlyName: string;
  roleTitle: string;
  f3dFileName: string;
  originalFormat: string;
  glbPath: string;
  previewImg: string;
  fileSizeStr: string;
  triangles: number;
  bodiesCount: number;
  version: number;
  createdAt: string;
  adskUrn: string;
  dimensionsMm: string;
  highlights: string[];
  description: string;
}

export const CAD_FILES_CATALOG: CadFileEntry[] = [
  {
    id: 'somo-assembly',
    friendlyName: 'iro — Full Assembly',
    roleTitle: 'Master CAD Assembly (v24)',
    f3dFileName: '165d2249-c6b1-4ca9-84d7-4794f1933237.f3d',
    originalFormat: 'iro_v2 • Rev 24',
    glbPath: `${import.meta.env.BASE_URL}models/somo-assembly.glb`,
    previewImg: `${import.meta.env.BASE_URL}previews/somo-v4.png`,
    fileSizeStr: '29.7 MB',
    triangles: 144193,
    bodiesCount: 45,
    version: 24,
    createdAt: '2026-11-02',
    adskUrn: 'urn:adsk.wipprod:fs.file:vf.667v_ZJMT76Vh4LLLR-7Kw?version=24',
    dimensionsMm: '279 × 279 × 254 mm',
    highlights: ['16 nodes', '6 sensors & displays'],
    description: 'Complete iro assembly by somo.',
  },
  {
    id: 'gc9a01-display',
    friendlyName: 'GC9A01 1.28" Eye',
    roleTitle: 'Round IPS Display',
    f3dFileName: 'eb39b3f2-fab6-4a42-9353-6307bc7b0a09.zip.f3d',
    originalFormat: 'iro_v2 • STEP',
    glbPath: `${import.meta.env.BASE_URL}models/gc9a01-display.glb`,
    previewImg: `${import.meta.env.BASE_URL}previews/gc9a01-display.png`,
    fileSizeStr: '404 KB',
    triangles: 38304,
    bodiesCount: 23,
    version: 1,
    createdAt: '2026-06-06',
    adskUrn: 'urn:adsk.wipprod:fs.file:vf.k8onVNSwT7S7OnAU9pe4LQ?version=1',
    dimensionsMm: '38 × 45.5 × 11.2 mm',
    highlights: ['240×240 px', 'SPI'],
    description: 'Binocular round IPS display.',
  },
  {
    id: 'featherwing-tft',
    friendlyName: 'FeatherWing 2.4" TFT',
    roleTitle: 'Chest Touch Display',
    f3dFileName: '6727d270-3e2f-470e-9756-1819064eca93.zip.f3d',
    originalFormat: 'iro_v2 • STEP',
    glbPath: `${import.meta.env.BASE_URL}models/featherwing-tft.glb`,
    previewImg: `${import.meta.env.BASE_URL}previews/featherwing-tft.png`,
    fileSizeStr: '2.36 MB',
    triangles: 16558,
    bodiesCount: 1,
    version: 1,
    createdAt: '2026-04-24',
    adskUrn: 'urn:adsk.wipprod:fs.file:vf.HlxszbqkSHKQ5OniiiP_1w?version=1',
    dimensionsMm: '65 × 53 × 8 mm',
    highlights: ['320×240 px', 'Touch'],
    description: 'Chest touch display module.',
  },
  {
    id: 'arducam-b0332',
    friendlyName: 'Arducam B0332',
    roleTitle: 'Wide-Angle Camera',
    f3dFileName: '7fcd840a-b23b-44ad-b186-0fed7eaac5d4.zip.f3d',
    originalFormat: 'iro_v2 • STEP',
    glbPath: `${import.meta.env.BASE_URL}models/arducam-b0332.glb`,
    previewImg: `${import.meta.env.BASE_URL}previews/arducam-b0332.png`,
    fileSizeStr: '194 KB',
    triangles: 3406,
    bodiesCount: 1,
    version: 1,
    createdAt: '2026-10-23',
    adskUrn: 'urn:adsk.wipprod:fs.file:vf.jvacJ1N8SZKPiOj6BOA3Uw?version=1',
    dimensionsMm: '38 × 38 × 25.8 mm',
    highlights: ['M12 Lens', 'CSI-2'],
    description: 'Optical vision camera.',
  },
  {
    id: 'inmp441-mic',
    friendlyName: 'INMP441 I2S Mic',
    roleTitle: 'MEMS Microphone',
    f3dFileName: '9b94f29b-b387-4491-a198-e4171894c788.zip.f3d',
    originalFormat: 'iro_v2 • STEP',
    glbPath: `${import.meta.env.BASE_URL}models/inmp441-mic.glb`,
    previewImg: `${import.meta.env.BASE_URL}previews/inmp441-mic.png`,
    fileSizeStr: '1.02 MB',
    triangles: 13144,
    bodiesCount: 25,
    version: 1,
    createdAt: '2026-04-24',
    adskUrn: 'urn:adsk.wipprod:fs.file:vf.BKY0ti7-TeqBNF6IcMyrBQ?version=1',
    dimensionsMm: '14 × 14 × 13.9 mm',
    highlights: ['24-bit I2S', '61 dBA'],
    description: 'Omnidirectional digital microphone.',
  },
  {
    id: 'linear-actuator',
    friendlyName: 'Linear Actuator',
    roleTitle: 'Neck Lift Drive',
    f3dFileName: 'f3f598f1-e59e-41fc-8a61-ceb7cf9652ab.f3d',
    originalFormat: 'iro_v2 • F3D',
    glbPath: `${import.meta.env.BASE_URL}models/linear-actuator.glb`,
    previewImg: `${import.meta.env.BASE_URL}previews/linear-actuator.png`,
    fileSizeStr: '229 KB',
    triangles: 3265,
    bodiesCount: 6,
    version: 2,
    createdAt: '2026-10-18',
    adskUrn: 'urn:adsk.wipprod:fs.file:vf.WqDxv2dbRiyfVtesFd95og?version=2',
    dimensionsMm: '122.4 × 24.8 × 18.6 mm',
    highlights: ['50 mm Stroke', 'DC Drive'],
    description: 'Telescoping neck actuator.',
  },
  {
    id: 'raspberry-pi-5',
    friendlyName: 'Raspberry Pi 5',
    roleTitle: 'Compute Core',
    f3dFileName: '5613be21-e5ab-4ed0-a3fc-a9318b3f1f76.zip.f3d',
    originalFormat: 'iro_v2 • STEP',
    glbPath: `${import.meta.env.BASE_URL}models/raspberry-pi-5.glb`,
    previewImg: `${import.meta.env.BASE_URL}previews/raspberry-pi-5.png`,
    fileSizeStr: '6.32 MB',
    triangles: 2256,
    bodiesCount: 94,
    version: 1,
    createdAt: '2026-02-04',
    adskUrn: 'urn:adsk.wipprod:fs.file:vf.8YyzfHqvRJCshTTJiuRowA?version=1',
    dimensionsMm: '85 × 56 × 19 mm',
    highlights: ['Cortex-A76', '94 Solids'],
    description: 'On-device AI compute board.',
  },
  {
    id: 'somo-head-visor',
    friendlyName: 'Optical Eye Visor',
    roleTitle: 'Internal Eye Mount',
    f3dFileName: '2c8e076d-55c7-414e-a2ef-b17de71b282a.f3d',
    originalFormat: 'iro_v2 • F3D',
    glbPath: `${import.meta.env.BASE_URL}models/somo-head-visor.glb`,
    previewImg: `${import.meta.env.BASE_URL}previews/somo-assembly.png`,
    fileSizeStr: '1.25 MB',
    triangles: 38934,
    bodiesCount: 3,
    version: 15,
    createdAt: '2026-10-26',
    adskUrn: 'urn:adsk.wipprod:fs.file:vf.BFc01cwmRfSDbQBWius1qw?version=15',
    dimensionsMm: '124 × 107 × 79 mm',
    highlights: ['Binocular Baffle', '3 Bodies'],
    description: 'Internal binocular display retainer.',
  },
];

export const SPLINE_TEMPLATE_URL = 'https://prod.spline.design/kZDDjO5HuC9GJUM2/scene.splinecode';
export const SPLINE_COMMUNITY_FILE_URL =
  'https://community.spline.design/file/615b9422-9985-43f6-8593-d7d7bc3b0be1';
