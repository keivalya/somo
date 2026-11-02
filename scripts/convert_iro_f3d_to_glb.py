#!/usr/bin/env python3
"""
Extracts 3D meshes, scene graph hierarchy, and PBR materials from Autodesk Fusion 360 (.f3d)
archives inside `iro/` and exports standard glTF 2.0 binary (.glb) models for web & Spline use.
"""

import glob
import io
import json
import math
import os
import re
import struct
import subprocess
import zipfile

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IRO_DIR = os.path.join(ROOT_DIR, "iro_v2")
OUT_MODELS_DIR = os.path.join(ROOT_DIR, "public", "models")
OUT_PREVIEWS_DIR = os.path.join(ROOT_DIR, "public", "previews")

os.makedirs(OUT_MODELS_DIR, exist_ok=True)
os.makedirs(OUT_PREVIEWS_DIR, exist_ok=True)


def read_f3d_entry(zf_path: str, entry_name: str) -> bytes | None:
    with zipfile.ZipFile(zf_path) as z:
        if entry_name not in z.namelist():
            return None
        info = z.getinfo(entry_name)
        with open(zf_path, "rb") as f:
            f.seek(info.header_offset)
            hdr = f.read(30)
            fl = int.from_bytes(hdr[26:28], "little")
            el = int.from_bytes(hdr[28:30], "little")
            f.seek(info.header_offset + 30 + fl + el)
            raw = f.read(info.compress_size)
        if info.compress_type == 93:
            return subprocess.check_output(["zstd", "-d"], input=raw)
        elif info.compress_type == 0:
            return raw
        else:
            return z.read(entry_name)


def extract_preview_pngs():
    """Extracts embedded preview PNGs from all iro_v2/*.f3d archives."""
    mapping = {
        "165d2249-c6b1-4ca9-84d7-4794f1933237.f3d": "somo-v4.png",
        "2c8e076d-55c7-414e-a2ef-b17de71b282a.f3d": "somo-assembly.png",
        "f3f598f1-e59e-41fc-8a61-ceb7cf9652ab.f3d": "linear-actuator.png",
        "7fcd840a-b23b-44ad-b186-0fed7eaac5d4.zip.f3d": "arducam-b0332.png",
        "6727d270-3e2f-470e-9756-1819064eca93.zip.f3d": "featherwing-tft.png",
        "9b94f29b-b387-4491-a198-e4171894c788.zip.f3d": "inmp441-mic.png",
        "eb39b3f2-fab6-4a42-9353-6307bc7b0a09.zip.f3d": "gc9a01-display.png",
        "5613be21-e5ab-4ed0-a3fc-a9318b3f1f76.zip.f3d": "raspberry-pi-5.png",
    }
    for fname, out_name in mapping.items():
        fpath = os.path.join(IRO_DIR, fname)
        if not os.path.exists(fpath):
            continue
        data = read_f3d_entry(fpath, "FusionAssetName[Active]/Previews/big.png")
        if not data:
            data = read_f3d_entry(fpath, "FusionAssetName[Active]/Previews/small.png")
        if data:
            out_path = os.path.join(OUT_PREVIEWS_DIR, out_name)
            with open(out_path, "wb") as out:
                out.write(data)
            print(f"Extracted preview: {out_name} ({len(data)} bytes)")


def extract_protein_materials(zf_path: str) -> dict[str, tuple[float, float, float, float, float]]:
    """
    Parses DefinitionIteratorProperties.bin inside ProteinAsset.*.protein
    Returns { UUID: (r, g, b, metallic, roughness) } in 0..1 linear/sRGB range.
    """
    mats = {
        "12860230-3957-49DF-A04E-627831D12520": (0.784, 0.557, 0.027, 0.15, 0.28),  # SOMO Amber Gold
        "EEA6DAAC-6600-4E77-B4A2-72EE141C3435": (0.955, 0.952, 0.935, 0.05, 0.32),  # SOMO Warm Cream
        "0BC2A66B-8011-4D82-B1AB-AEEF205417E5": (0.965, 0.962, 0.948, 0.05, 0.30),  # SOMO Soft White
        "E7DA5399-46C4-4A16-BEEE-84B0E440E635": (0.702, 0.706, 0.718, 0.65, 0.35),  # Brushed Silver
        "E4AE3015-08BB-4BB6-8FED-F34FBECBD966": (0.792, 0.820, 0.933, 0.45, 0.30),  # Cool Anodized Silver
        "40AC0EA9-3589-44F7-8089-0013266FAD73": (0.620, 0.635, 0.660, 0.70, 0.35),  # Steel / Chassis
        "5400DFE1-A558-4191-B01C-BC40FC5460ED": (0.160, 0.280, 0.480, 0.20, 0.40),  # Deep Blue PCB
        "18F14D6E-3DA5-4E6C-80F9-A32D176BD2F1": (0.086, 0.314, 0.898, 0.15, 0.38),  # GC9A01 Blue PCB
        "C2F679B3-41F5-4CFE-9577-A955AC446D09": (0.850, 0.680, 0.180, 0.85, 0.22),  # Gold Contacts
        "191F2280-B68E-4BA0-A2B8-A067916744D4": (0.880, 0.885, 0.900, 0.85, 0.20),  # Silver Pins
        "84F47D4D-A790-435D-A738-CF5A44145946": (0.080, 0.090, 0.110, 0.10, 0.15),  # Display Glass Black
        "CC3995B8-AE70-4A76-B311-B2A04F6DA7E2": (0.050, 0.060, 0.080, 0.08, 0.12),  # Active OLED Screen
        "4F2F1993-136D-41F2-9C6F-5E54B65C55E0": (0.110, 0.110, 0.115, 0.10, 0.65),  # Matte Black Header
        "9C1BF4B9-92E8-4CC7-9D95-7478C18E70F2": (0.780, 0.780, 0.790, 0.75, 0.30),  # SMD Metal
        "D6DD46D6-920D-45FC-989E-A25E841EA31F": (0.720, 0.560, 0.320, 0.30, 0.45),  # SMD Capacitor Tan
    }
    with zipfile.ZipFile(zf_path) as z:
        for info in z.infolist():
            if info.filename.endswith(".protein") and "FusionAssetName" in info.filename:
                data = read_f3d_entry(zf_path, info.filename)
                if not data:
                    continue
                pk = data.find(b"PK\x03\x04")
                if pk == -1:
                    continue
                with zipfile.ZipFile(io.BytesIO(data[pk:])) as pz:
                    for n in pz.namelist():
                        if n.endswith("DefinitionIteratorProperties.bin"):
                            defn = pz.read(n).decode("utf-8", errors="ignore")
                            for m in re.finditer(
                                r"Opaque\((\d+),(\d+),(\d+)\).*?Resources/([0-9A-F-]{36})",
                                defn,
                                re.DOTALL,
                            ):
                                r, g, b, uuid = (
                                    int(m.group(1)) / 255.0,
                                    int(m.group(2)) / 255.0,
                                    int(m.group(3)) / 255.0,
                                    m.group(4),
                                )
                                if uuid not in mats:
                                    mats[uuid] = (r, g, b, 0.15, 0.35)
    return mats


def transform_pos_f360_to_gltf(x: float, y: float, z: float, mat4: list[float] | None = None):
    if mat4 is not None:
        tx = mat4[0] * x + mat4[4] * y + mat4[8] * z + mat4[12]
        ty = mat4[1] * x + mat4[5] * y + mat4[9] * z + mat4[13]
        tz = mat4[2] * x + mat4[6] * y + mat4[10] * z + mat4[14]
        x, y, z = tx, ty, tz
    # Map Fusion 360 (X right, -Y front, Z up) -> glTF (X right, Y up, +Z front)
    return (x, z, -y)


def transform_norm_f360_to_gltf(nx: float, ny: float, nz: float, mat4: list[float] | None = None):
    if mat4 is not None:
        tnx = mat4[0] * nx + mat4[4] * ny + mat4[8] * nz
        tny = mat4[1] * nx + mat4[5] * ny + mat4[9] * nz
        tnz = mat4[2] * nx + mat4[6] * ny + mat4[10] * nz
        length = math.sqrt(tnx * tnx + tny * tny + tnz * tnz) or 1.0
        nx, ny, nz = tnx / length, tny / length, tnz / length
    return (nx, nz, -ny)


def mat4_det3x3(m: list[float]) -> float:
    return (
        m[0] * (m[5] * m[10] - m[6] * m[9])
        - m[1] * (m[4] * m[10] - m[6] * m[8])
        + m[2] * (m[4] * m[9] - m[5] * m[8])
    )


def parse_ogs_bodies(zf_path: str):
    """
    Parses all meshed 3D Bodies from an .f3d file's OGS/DefaultScene/world and Fusion_mesh_000.
    Returns a list of body dicts:
      {
        'body_index': int,
        'body_pos': int,
        'body_mat': str | None,
        'faces': [
          {
            'face_mat': str | None,
            'positions': [(x,y,z), ...],
            'normals': [(nx,ny,nz), ...],
            'indices': [i0, i1, i2, ...]
          }
        ]
      }
    """
    w = read_f3d_entry(zf_path, "FusionAssetName[Active]/OGS.BlobFolder/OGS/DefaultScene/world")
    m = read_f3d_entry(zf_path, "FusionAssetName[Active]/OGS.BlobFolder/OGS/DefaultScene/Fusion_mesh_000")
    if not w or not m:
        return [], w

    body_positions = [x.start() for x in re.finditer("Body\x00".encode("utf-16le"), w)]
    bodies = []

    for b_idx, bpos in enumerate(body_positions):
        fpos = w.rfind("Faces\x00".encode("utf-16le"), 0, bpos)
        if fpos == -1:
            continue
        before = w[max(0, fpos - 250) : fpos]
        strs_before = [x.group().decode("utf-16le") for x in re.finditer(b"(?:[ -~]\x00){3,}", before)]
        default_body_mat = None
        for s in strs_before:
            if "-" in s and len(s) == 36:
                default_body_mat = s

        faces_offsets = [fpos + x.start() for x in re.finditer("Face\x00".encode("utf-16le"), w[fpos:bpos])]
        if not faces_offsets:
            continue

        # Check body-level override material between last face and Body tag
        body_tail = w[faces_offsets[-1] + 89 : bpos]
        body_override_mat = None
        for s in [x.group().decode("utf-16le") for x in re.finditer(b"(?:[ -~]\x00){3,}", body_tail)]:
            if "-" in s and len(s) == 36:
                body_override_mat = s

        effective_body_mat = body_override_mat or default_body_mat
        parsed_faces = []

        for idx_f, fp in enumerate(faces_offsets):
            if w[fp + 54 : fp + 65] != b"\x08\x00\x00\x07\x00\x00\x00\x00\x00\x00\x00":
                continue
            u1, u2, u3, u4, u5, u6 = struct.unpack("<6I", w[fp + 65 : fp + 89])
            n_verts = u2 // 3
            if n_verts == 0 or u5 == 0:
                continue

            # Check per-face material immediately before this Face tag
            prev_end = (faces_offsets[idx_f - 1] + 89) if idx_f > 0 else fpos
            pre_chunk = w[prev_end:fp]
            fmat = None
            for s in [x.group().decode("utf-16le") for x in re.finditer(b"(?:[ -~]\x00){3,}", pre_chunk)]:
                if "-" in s and len(s) == 36:
                    fmat = s

            v_bytes = n_verts * 32
            verts_raw = struct.unpack(f"<{n_verts * 8}f", m[u1 : u1 + v_bytes])
            idx_raw = struct.unpack(f"<{u5}I", m[u1 + v_bytes : u1 + v_bytes + u5 * 4])

            positions = [(verts_raw[k * 8], verts_raw[k * 8 + 1], verts_raw[k * 8 + 2]) for k in range(n_verts)]
            normals = [(verts_raw[k * 8 + 3], verts_raw[k * 8 + 4], verts_raw[k * 8 + 5]) for k in range(n_verts)]

            parsed_faces.append(
                {
                    "face_index": idx_f,
                    "face_mat": fmat or effective_body_mat,
                    "raw_face_mat": fmat,
                    "positions": positions,
                    "normals": normals,
                    "indices": list(idx_raw),
                }
            )

        if parsed_faces:
            bodies.append(
                {
                    "body_index": b_idx,
                    "body_pos": bpos,
                    "body_mat": effective_body_mat,
                    "faces": parsed_faces,
                }
            )

    return bodies, w


class GLBBuilder:
    """Builds a standard glTF 2.0 binary (.glb) file with multiple named nodes and PBR materials."""

    def __init__(self):
        self.materials = []
        self.mat_map = {}
        self.nodes = []
        self.meshes = []
        self.accessors = []
        self.buffer_views = []
        self.bin_chunks = bytearray()

    def get_or_add_material(self, name: str, rgba: tuple[float, float, float, float], metallic=0.15, roughness=0.35, emissive=(0.0, 0.0, 0.0)):
        key = (name, tuple(round(x, 3) for x in rgba), round(metallic, 2), round(roughness, 2), tuple(round(x, 3) for x in emissive))
        if key in self.mat_map:
            return self.mat_map[key]
        idx = len(self.materials)
        mat_def = {
            "name": name,
            "doubleSided": True,
            "pbrMetallicRoughness": {
                "baseColorFactor": list(rgba),
                "metallicFactor": metallic,
                "roughnessFactor": roughness,
            },
        }
        if rgba[3] < 0.999:
            mat_def["alphaMode"] = "BLEND"
        if any(c > 0 for c in emissive):
            mat_def["emissiveFactor"] = list(emissive)
        self.materials.append(mat_def)
        self.mat_map[key] = idx
        return idx

    def _align4(self):
        rem = len(self.bin_chunks) % 4
        if rem:
            self.bin_chunks.extend(b"\x00" * (4 - rem))

    def add_node_primitives(self, node_name: str, primitives_data: list[dict]):
        """
        primitives_data: list of {
          'mat_idx': int,
          'positions': [(x,y,z), ...],
          'normals': [(nx,ny,nz), ...],
          'indices': [i0, i1, i2, ...]
        }
        """
        gltf_prims = []
        for prim in primitives_data:
            positions = prim["positions"]
            normals = prim["normals"]
            indices = prim["indices"]
            if not positions or not indices:
                continue

            # Position buffer view
            self._align4()
            pos_offset = len(self.bin_chunks)
            for p in positions:
                self.bin_chunks.extend(struct.pack("<3f", *p))
            pos_len = len(self.bin_chunks) - pos_offset

            xs = [p[0] for p in positions]
            ys = [p[1] for p in positions]
            zs = [p[2] for p in positions]
            pos_min = [min(xs), min(ys), min(zs)]
            pos_max = [max(xs), max(ys), max(zs)]

            pos_bv = len(self.buffer_views)
            self.buffer_views.append(
                {"buffer": 0, "byteOffset": pos_offset, "byteLength": pos_len, "target": 34962}
            )
            pos_acc = len(self.accessors)
            self.accessors.append(
                {
                    "bufferView": pos_bv,
                    "byteOffset": 0,
                    "componentType": 5126,
                    "count": len(positions),
                    "type": "VEC3",
                    "min": pos_min,
                    "max": pos_max,
                }
            )

            # Normal buffer view
            self._align4()
            norm_offset = len(self.bin_chunks)
            for n in normals:
                length = math.sqrt(n[0] * n[0] + n[1] * n[1] + n[2] * n[2]) or 1.0
                self.bin_chunks.extend(struct.pack("<3f", n[0] / length, n[1] / length, n[2] / length))
            norm_len = len(self.bin_chunks) - norm_offset

            norm_bv = len(self.buffer_views)
            self.buffer_views.append(
                {"buffer": 0, "byteOffset": norm_offset, "byteLength": norm_len, "target": 34962}
            )
            norm_acc = len(self.accessors)
            self.accessors.append(
                {
                    "bufferView": norm_bv,
                    "byteOffset": 0,
                    "componentType": 5126,
                    "count": len(normals),
                    "type": "VEC3",
                }
            )

            # Index buffer view
            self._align4()
            idx_offset = len(self.bin_chunks)
            for idx_val in indices:
                self.bin_chunks.extend(struct.pack("<I", idx_val))
            idx_len = len(self.bin_chunks) - idx_offset

            idx_bv = len(self.buffer_views)
            self.buffer_views.append(
                {"buffer": 0, "byteOffset": idx_offset, "byteLength": idx_len, "target": 34963}
            )
            idx_acc = len(self.accessors)
            self.accessors.append(
                {
                    "bufferView": idx_bv,
                    "byteOffset": 0,
                    "componentType": 5125,
                    "count": len(indices),
                    "type": "SCALAR",
                }
            )

            gltf_prims.append(
                {
                    "attributes": {"POSITION": pos_acc, "NORMAL": norm_acc},
                    "indices": idx_acc,
                    "material": prim["mat_idx"],
                    "mode": 4,
                }
            )

        if not gltf_prims:
            return

        mesh_idx = len(self.meshes)
        self.meshes.append({"name": node_name, "primitives": gltf_prims})
        self.nodes.append({"name": node_name, "mesh": mesh_idx})

    def save_glb(self, out_path: str):
        self._align4()
        gltf = {
            "asset": {"version": "2.0", "generator": "SOMO Fusion360 OGS-to-GLB Converter"},
            "scene": 0,
            "scenes": [{"name": "Scene", "nodes": list(range(len(self.nodes)))}],
            "nodes": self.nodes,
            "meshes": self.meshes,
            "materials": self.materials,
            "accessors": self.accessors,
            "bufferViews": self.buffer_views,
            "buffers": [{"byteLength": len(self.bin_chunks)}],
        }
        json_bytes = json.dumps(gltf, separators=(",", ":")).encode("utf-8")
        json_pad = (4 - (len(json_bytes) % 4)) % 4
        json_bytes += b" " * json_pad

        total_len = 12 + 8 + len(json_bytes) + 8 + len(self.bin_chunks)
        with open(out_path, "wb") as f:
            f.write(struct.pack("<III", 0x46546C67, 2, total_len))
            f.write(struct.pack("<II", len(json_bytes), 0x4E4F534A))
            f.write(json_bytes)
            f.write(struct.pack("<II", len(self.bin_chunks), 0x004E4942))
            f.write(self.bin_chunks)
        print(f"Saved GLB: {os.path.basename(out_path)} ({total_len / 1024:.1f} KB, {len(self.nodes)} nodes)")


def build_box_mesh(xmin, ymin, zmin, xmax, ymax, zmax, mat4=None):
    """Generates a 24-vertex (sharp-normal) 3D box in glTF coordinates."""
    faces_def = [
        # +Z, -Z, +X, -X, +Y, -Y in Fusion coords
        ([(xmin, ymin, zmax), (xmax, ymin, zmax), (xmax, ymax, zmax), (xmin, ymax, zmax)], (0, 0, 1)),
        ([(xmin, ymax, zmin), (xmax, ymax, zmin), (xmax, ymin, zmin), (xmin, ymin, zmin)], (0, 0, -1)),
        ([(xmax, ymin, zmin), (xmax, ymax, zmin), (xmax, ymax, zmax), (xmax, ymin, zmax)], (1, 0, 0)),
        ([(xmin, ymax, zmin), (xmin, ymin, zmin), (xmin, ymin, zmax), (xmin, ymax, zmax)], (-1, 0, 0)),
        ([(xmin, ymax, zmax), (xmax, ymax, zmax), (xmax, ymax, zmin), (xmin, ymax, zmin)], (0, 1, 0)),
        ([(xmin, ymin, zmin), (xmax, ymin, zmin), (xmax, ymin, zmax), (xmin, ymin, zmax)], (0, -1, 0)),
    ]
    positions = []
    normals = []
    indices = []
    flip = mat4 is not None and mat4_det3x3(mat4) < 0
    for corners, n in faces_def:
        base = len(positions)
        gn = transform_norm_f360_to_gltf(n[0], n[1], n[2], mat4)
        for c in corners:
            positions.append(transform_pos_f360_to_gltf(c[0], c[1], c[2], mat4))
            normals.append(gn)
        if flip:
            indices.extend([base, base + 2, base + 1, base, base + 3, base + 2])
        else:
            indices.extend([base, base + 1, base + 2, base, base + 2, base + 3])
    return positions, normals, indices


def extract_raspberry_pi_5_primitives(glb: GLBBuilder, mat4: list[float] | None = None):
    """
    Extracts the 94 B-Rep (.smb) bodies from 5613be21-e5ab-4ed0-a3fc-a9318b3f1f76.zip.f3d
    (raspberry_pi_5.step) and groups them by realistic PBR materials (PCB Green, Gold GPIO pins,
    Aluminum Ports/Heatspreader, Dark Silicon IC packages).
    """
    zf_path = os.path.join(IRO_DIR, "5613be21-e5ab-4ed0-a3fc-a9318b3f1f76.zip.f3d")
    mat_pcb = glb.get_or_add_material("RPi5_PCB_Green", (0.08, 0.42, 0.22, 1.0), metallic=0.15, roughness=0.40)
    mat_gold = glb.get_or_add_material("RPi5_Gold_Pins", (0.88, 0.72, 0.22, 1.0), metallic=0.90, roughness=0.20)
    mat_metal = glb.get_or_add_material("RPi5_Metal_Shields", (0.76, 0.78, 0.81, 1.0), metallic=0.85, roughness=0.25)
    mat_ic = glb.get_or_add_material("RPi5_Dark_IC", (0.14, 0.15, 0.17, 1.0), metallic=0.20, roughness=0.55)
    mat_usb_blue = glb.get_or_add_material("RPi5_USB3_Blue", (0.10, 0.38, 0.82, 1.0), metallic=0.10, roughness=0.45)

    buckets = {
        mat_pcb: {"positions": [], "normals": [], "indices": []},
        mat_gold: {"positions": [], "normals": [], "indices": []},
        mat_metal: {"positions": [], "normals": [], "indices": []},
        mat_ic: {"positions": [], "normals": [], "indices": []},
        mat_usb_blue: {"positions": [], "normals": [], "indices": []},
    }

    # Center offset of the Raspberry Pi 5 PCB (SMB[63] is 2.80..11.30, 0.80..6.40, -1.28..-0.99)
    cx, cy, cz = 7.05, 3.60, -1.00

    with zipfile.ZipFile(zf_path) as z:
        smbs = [i for i in z.infolist() if i.filename.endswith(".smb")]
        for idx, info in enumerate(smbs):
            data = read_f3d_entry(zf_path, info.filename)
            if not data:
                continue
            pts = []
            for m in re.finditer(b"\x05point.{15}\x13", data, re.DOTALL):
                p = m.start()
                x, y, z = struct.unpack("<3d", data[p + 22 : p + 46])
                pts.append((x, y, z))
            if not pts:
                continue
            xs = [p[0] for p in pts]
            ys = [p[1] for p in pts]
            zs = [p[2] for p in pts]
            xmin, xmax = min(xs), max(xs)
            ymin, ymax = min(ys), max(ys)
            zmin, zmax = min(zs), max(zs)
            dx, dy, dz = xmax - xmin, ymax - ymin, zmax - zmin

            # Local bodies inside RPi5 (near 0,0,0) are ports/connectors; translate them to their board edge positions
            if xmin > 1.5:
                ox, oy, oz = -cx, -cy, -cz
            else:
                # Port components (Ethernet, USB3, USB2, HDMI, USB-C, MIPI)
                if idx == 53:  # Ethernet RJ45
                    ox, oy, oz = 3.4, -1.9, 1.0
                elif idx == 30:  # USB 3.0 stack
                    ox, oy, oz = 3.4, 0.1, 1.0
                elif idx == 61:  # USB 2.0 stack
                    ox, oy, oz = 3.4, 1.9, 1.0
                elif idx in (86, 87):  # MIPI CSI/DSI headers
                    ox, oy, oz = 0.8, (-0.8 if idx == 86 else 0.8), 0.2
                elif idx == 80:  # USB-C port
                    ox, oy, oz = -2.8, -2.5, 0.35
                elif idx == 66:  # Micro-HDMI
                    ox, oy, oz = -1.2, -2.5, 0.35
                else:
                    continue

            b_xmin, b_ymin, b_zmin = xmin + ox, ymin + oy, zmin + oz
            b_xmax, b_ymax, b_zmax = xmax + ox, ymax + oy, zmax + oz

            if idx == 63:
                chosen_mat = mat_pcb
            elif len(pts) == 8 and dx < 0.15 and dy < 0.15 and dz > 0.4:
                chosen_mat = mat_gold
            elif idx in (52, 8, 28, 86, 87):
                chosen_mat = mat_ic
            elif idx == 30:
                chosen_mat = mat_usb_blue
            elif idx in (51, 53, 61, 80, 66, 90):
                chosen_mat = mat_metal
            else:
                chosen_mat = mat_ic

            pos, norm, ind = build_box_mesh(b_xmin, b_ymin, b_zmin, b_xmax, b_ymax, b_zmax, mat4)
            bkt = buckets[chosen_mat]
            base_v = len(bkt["positions"])
            bkt["positions"].extend(pos)
            bkt["normals"].extend(norm)
            bkt["indices"].extend(i + base_v for i in ind)

    prims = []
    for mat_id, bkt in buckets.items():
        if bkt["positions"]:
            prims.append(
                {
                    "mat_idx": mat_id,
                    "positions": bkt["positions"],
                    "normals": bkt["normals"],
                    "indices": bkt["indices"],
                }
            )
    return prims


def combine_bodies_into_primitives(
    glb: GLBBuilder,
    bodies: list[dict],
    mats_lookup: dict,
    mat4: list[float] | None = None,
    override_mat_fn=None,
):
    """Groups faces from a list of bodies by material index and transforms into glTF space."""
    by_mat = {}
    flip = mat4 is not None and mat4_det3x3(mat4) < 0

    for body in bodies:
        b_idx = body["body_index"]
        for face in body["faces"]:
            if override_mat_fn is not None:
                mat_idx = override_mat_fn(glb, b_idx, face, mats_lookup)
            else:
                uuid = face["face_mat"]
                if uuid in mats_lookup:
                    r, g, b, met, rough = mats_lookup[uuid]
                    mat_idx = glb.get_or_add_material(f"Mat_{uuid[:8]}", (r, g, b, 1.0), met, rough)
                else:
                    mat_idx = glb.get_or_add_material("Mat_DefaultSteel", (0.68, 0.70, 0.73, 1.0), 0.55, 0.35)

            if mat_idx not in by_mat:
                by_mat[mat_idx] = {"positions": [], "normals": [], "indices": []}
            bucket = by_mat[mat_idx]
            base_v = len(bucket["positions"])

            for x, y, z in face["positions"]:
                bucket["positions"].append(transform_pos_f360_to_gltf(x, y, z, mat4))
            for nx, ny, nz in face["normals"]:
                bucket["normals"].append(transform_norm_f360_to_gltf(nx, ny, nz, mat4))

            idxs = face["indices"]
            if flip:
                for t in range(0, len(idxs), 3):
                    bucket["indices"].extend([base_v + idxs[t], base_v + idxs[t + 2], base_v + idxs[t + 1]])
            else:
                for i in idxs:
                    bucket["indices"].append(base_v + i)

    return [
        {
            "mat_idx": mid,
            "positions": data["positions"],
            "normals": data["normals"],
            "indices": data["indices"],
        }
        for mid, data in by_mat.items()
    ]


def export_standalone_component_glb(f3d_filename: str, out_glb_name: str, default_rgba=(0.72, 0.74, 0.78, 1.0), metallic=0.4, roughness=0.35):
    zf_path = os.path.join(IRO_DIR, f3d_filename)
    bodies, _ = parse_ogs_bodies(zf_path)
    mats_lookup = extract_protein_materials(zf_path)
    glb = GLBBuilder()

    # Center the standalone component around (0,0,0) for clean 3D inspection
    all_pts = [p for b in bodies for f in b["faces"] for p in f["positions"]]
    cx = (min(p[0] for p in all_pts) + max(p[0] for p in all_pts)) / 2.0
    cy = (min(p[1] for p in all_pts) + max(p[1] for p in all_pts)) / 2.0
    cz = (min(p[2] for p in all_pts) + max(p[2] for p in all_pts)) / 2.0
    center_mat4 = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, -cx, -cy, -cz, 1]

    def custom_mat(g: GLBBuilder, b_idx: int, face: dict, ml: dict):
        uuid = face["face_mat"]
        if out_glb_name == "featherwing-tft.glb":
            # Color the PCB dark navy, screen glass glossy black, SD slot silver
            zs = [p[2] for p in face["positions"]]
            if max(zs) - min(zs) < 0.25 and len(face["indices"]) > 300:
                return g.get_or_add_material("FeatherWing_PCB", (0.12, 0.14, 0.18, 1.0), 0.20, 0.45)
            return g.get_or_add_material("FeatherWing_Detail", (0.72, 0.74, 0.78, 1.0), 0.75, 0.28)
        if out_glb_name == "arducam-b0332.glb":
            ys = [p[1] for p in face["positions"]]
            if max(ys) > 0.35 or min(ys) < -0.35:
                return g.get_or_add_material("Arducam_Lens_Barrel", (0.14, 0.15, 0.18, 1.0), 0.35, 0.25)
            return g.get_or_add_material("Arducam_PCB", (0.16, 0.32, 0.24, 1.0), 0.20, 0.45)
        if out_glb_name == "linear-actuator.glb":
            if b_idx in (0, 1):
                return g.get_or_add_material("Actuator_Housing", (0.28, 0.29, 0.32, 1.0), 0.65, 0.35)
            return g.get_or_add_material("Actuator_Rod_Silver", (0.82, 0.84, 0.88, 1.0), 0.88, 0.18)
        if uuid in ml:
            r, g_c, b_c, met, rough = ml[uuid]
            return g.get_or_add_material(f"Mat_{uuid[:8]}", (r, g_c, b_c, 1.0), met, rough)
        return g.get_or_add_material("Component_Default", default_rgba, metallic, roughness)

    prims = combine_bodies_into_primitives(glb, bodies, mats_lookup, mat4=center_mat4, override_mat_fn=custom_mat)
    glb.add_node_primitives(out_glb_name.replace(".glb", ""), prims)
    glb.save_glb(os.path.join(OUT_MODELS_DIR, out_glb_name))


def build_v24_front_panel_and_screen(glb: GLBBuilder, body8: dict, mat_cream: int, mat_amber: int, mat_tft_screen: int):
    """
    Constructs the v24 (165d2249.f3d) Front Cream Arch Panel (`Panel_Front_Cream`) and recessed
    Chest TFT Screen (`Screen_Chest_TFT`):
    - Reflects the clean arch panel `Body[8]` onto the -Y front face ((x,y,z) -> (y,x,z)).
    - Cuts ONLY the v24 centered rounded-rectangle TFT window (x in [-3.18, +3.18], z in [5.45, 10.85], r=0.42),
      eliminating the old v15 camera and microphone holes.
    - Adds the v24 warm amber chamfered inner bezel (`tft_clamp`) and recessed charcoal-grey TFT screen face.
    """
    from collections import defaultdict
    import numpy as np
    from scipy.spatial import Delaunay
    from matplotlib.path import Path

    cream_bucket = {"positions": [], "normals": [], "indices": []}
    amber_bucket = {"positions": [], "normals": [], "indices": []}
    screen_bucket = {"positions": [], "normals": [], "indices": []}

    def append_raw_face(bkt, positions_f360, normals_f360, indices, flip_winding=False):
        base_v = len(bkt["positions"])
        for x, y, z in positions_f360:
            bkt["positions"].append(transform_pos_f360_to_gltf(x, y, z))
        for nx, ny, nz in normals_f360:
            bkt["normals"].append(transform_norm_f360_to_gltf(nx, ny, nz))
        if flip_winding:
            for t in range(0, len(indices), 3):
                bkt["indices"].extend([base_v + indices[t], base_v + indices[t + 2], base_v + indices[t + 1]])
        else:
            for i in indices:
                bkt["indices"].append(base_v + i)

    # 1. Copy all border/rim/skirt faces of Body[8] mapped (x,y,z) -> (y,x,z) except face[12] (outer) & face[4] (inner)
    for f in body8["faces"]:
        fi = f["face_index"]
        if fi in (4, 12):
            continue
        pos_swapped = [(p[1], p[0], p[2]) for p in f["positions"]]
        norm_swapped = [(n[1], n[0], n[2]) for n in f["normals"]]
        append_raw_face(cream_bucket, pos_swapped, norm_swapped, f["indices"], flip_winding=True)

    # Helper to generate a densely sampled rounded-rectangle loop in (x, z)
    def make_round_rect_loop(x_half: float, z_min: float, z_max: float, radius: float, n_corner: int = 10, n_side: int = 22):
        z_mid = 0.5 * (z_min + z_max)
        z_half = 0.5 * (z_max - z_min)
        r = radius
        x_R = x_half - r
        x_L = -x_half + r
        z_T = z_mid + z_half - r
        z_B = z_mid - z_half + r

        loop_pts = []
        # Top-right corner (0 -> pi/2)
        for k in range(n_corner):
            ang = (math.pi * 0.5) * (k / n_corner)
            loop_pts.append((x_R + r * math.cos(ang), z_T + r * math.sin(ang)))
        # Top straight edge (x_R -> x_L at z = z_max)
        for k in range(n_side):
            t = k / n_side
            loop_pts.append((x_R + (x_L - x_R) * t, z_max))
        # Top-left corner (pi/2 -> pi)
        for k in range(n_corner):
            ang = math.pi * 0.5 + (math.pi * 0.5) * (k / n_corner)
            loop_pts.append((x_L + r * math.cos(ang), z_T + r * math.sin(ang)))
        # Left straight edge (z_T -> z_B at x = -x_half)
        for k in range(n_side):
            t = k / n_side
            loop_pts.append((-x_half, z_T + (z_B - z_T) * t))
        # Bottom-left corner (pi -> 3pi/2)
        for k in range(n_corner):
            ang = math.pi + (math.pi * 0.5) * (k / n_corner)
            loop_pts.append((x_L + r * math.cos(ang), z_B + r * math.sin(ang)))
        # Bottom straight edge (x_L -> x_R at z = z_min)
        for k in range(n_side):
            t = k / n_side
            loop_pts.append((x_L + (x_R - x_L) * t, z_min))
        # Bottom-right corner (3pi/2 -> 2pi)
        for k in range(n_corner):
            ang = math.pi * 1.5 + (math.pi * 0.5) * (k / n_corner)
            loop_pts.append((x_R + r * math.cos(ang), z_B + r * math.sin(ang)))
        # Right straight edge (z_B -> z_T at x = +x_half)
        for k in range(n_side):
            t = k / n_side
            loop_pts.append((x_half, z_B + (z_T - z_B) * t))
        return loop_pts

    hole_outer_xz = make_round_rect_loop(3.18, 5.45, 10.85, 0.42, n_corner=10, n_side=22)
    hole_inner_xz = make_round_rect_loop(2.92, 5.71, 10.59, 0.32, n_corner=10, n_side=22)

    # Helper to triangulate a curved arch face (face[12] outer or face[4] inner) with the rounded-rect hole
    def triangulate_arch_face_with_hole(face_dict, hole_xz, is_inner_face=False):
        pts_swapped = [(p[1], p[0], p[2]) for p in face_dict["positions"]]
        idxs = face_dict["indices"]

        zs_arr = np.array([p[2] for p in pts_swapped])
        rs_arr = np.array([math.hypot(p[0], p[1]) for p in pts_swapped])
        poly_r = np.polyfit(zs_arr, rs_arr, 5)
        poly_dr = np.polyder(poly_r)

        edge_counts = defaultdict(int)
        directed = {}
        for t in range(0, len(idxs), 3):
            a, b, c = idxs[t], idxs[t + 2], idxs[t + 1]
            for u, v in [(a, b), (b, c), (c, a)]:
                edge_counts[(min(u, v), max(u, v))] += 1
                directed[(u, v)] = True

        b_next = {}
        for (u, v) in directed:
            if edge_counts[(min(u, v), max(u, v))] == 1:
                b_next[u] = v

        start = next(iter(b_next))
        loop_indices = [start]
        cur = b_next[start]
        while cur != start and len(loop_indices) < len(pts_swapped):
            loop_indices.append(cur)
            cur = b_next[cur]

        outer_poly_xz = [(pts_swapped[i][0], pts_swapped[i][2]) for i in loop_indices]
        outer_path = Path(outer_poly_xz)
        hole_path = Path(hole_xz)

        # Combine boundary vertices, hole vertices, and interior points outside the hole
        all_xz = list(outer_poly_xz) + list(hole_xz)
        for p in pts_swapped:
            pt2 = (p[0], p[2])
            if not hole_path.contains_point(pt2, radius=0.18):
                all_xz.append(pt2)

        pts_2d = np.array(all_xz)
        tri = Delaunay(pts_2d)
        valid_tris = []
        for s in tri.simplices:
            p0, p1, p2 = pts_2d[s[0]], pts_2d[s[1]], pts_2d[s[2]]
            centroid = (p0 + p1 + p2) / 3.0
            if outer_path.contains_point(centroid, radius=-1e-4) and not hole_path.contains_point(centroid, radius=1e-4):
                # Ensure 2D CCW winding in (x, z)
                cross = (p1[0] - p0[0]) * (p2[1] - p0[1]) - (p1[1] - p0[1]) * (p2[0] - p0[0])
                if cross > 0:
                    valid_tris.append((int(s[0]), int(s[1]), int(s[2])))
                else:
                    valid_tris.append((int(s[0]), int(s[2]), int(s[1])))

        pos_3d = []
        norm_3d = []
        for idx_pt, (x_val, z_val) in enumerate(all_xz):
            if idx_pt < len(loop_indices):
                # Exact original boundary vertex so outer seam is 100% watertight
                orig_i = loop_indices[idx_pt]
                px, py, pz = pts_swapped[orig_i]
            else:
                r_val = float(np.polyval(poly_r, z_val))
                py = -math.sqrt(max(0.01, r_val * r_val - x_val * x_val))
                px, pz = x_val, z_val

            dr_dz = float(np.polyval(poly_dr, pz))
            r_xy = math.hypot(px, py) or 1.0
            nx = px / r_xy
            ny = py / r_xy
            nz = -dr_dz
            n_len = math.sqrt(nx * nx + ny * ny + nz * nz) or 1.0
            if is_inner_face:
                nx, ny, nz = -nx / n_len, -ny / n_len, -nz / n_len
            else:
                nx, ny, nz = nx / n_len, ny / n_len, nz / n_len

            pos_3d.append((px, py, pz))
            norm_3d.append((nx, ny, nz))

        flat_indices = []
        for a, b, c in valid_tris:
            if is_inner_face:
                flat_indices.extend([a, c, b])
            else:
                flat_indices.extend([a, b, c])

        append_raw_face(cream_bucket, pos_3d, norm_3d, flat_indices, flip_winding=False)
        return poly_r

    poly_r_outer = triangulate_arch_face_with_hole(body8["faces"][12], hole_outer_xz, is_inner_face=False)
    triangulate_arch_face_with_hole(body8["faces"][4], hole_outer_xz, is_inner_face=True)

    # 2. Build the v24 Warm Amber Chamfered TFT Bezel (`tft_clamp`) connecting hole_outer_xz to hole_inner_xz
    n_loop = len(hole_outer_xz)
    bezel_pos = []
    bezel_norm = []
    bezel_idx = []
    y_screen_plane = -12.15

    for k in range(n_loop):
        k_next = (k + 1) % n_loop
        x0_out, z0_out = hole_outer_xz[k]
        x1_out, z1_out = hole_outer_xz[k_next]
        r0 = float(np.polyval(poly_r_outer, z0_out))
        r1 = float(np.polyval(poly_r_outer, z1_out))
        y0_out = -math.sqrt(max(0.01, r0 * r0 - x0_out * x0_out))
        y1_out = -math.sqrt(max(0.01, r1 * r1 - x1_out * x1_out))

        x0_in, z0_in = hole_inner_xz[k]
        x1_in, z1_in = hole_inner_xz[k_next]
        # Slanted screen plane matching the arch slope
        y0_in = y_screen_plane + (z0_in - 8.15) * 0.19
        y1_in = y_screen_plane + (z1_in - 8.15) * 0.19

        # Mid-lip step for rich CAD bezel detail
        x0_mid = 0.35 * x0_out + 0.65 * x0_in
        z0_mid = 0.35 * z0_out + 0.65 * z0_in
        y0_mid = 0.25 * y0_out + 0.75 * y0_in

        x1_mid = 0.35 * x1_out + 0.65 * x1_in
        z1_mid = 0.35 * z1_out + 0.65 * z1_in
        y1_mid = 0.25 * y1_out + 0.75 * y1_in

        for (pa, pb, pc, pd) in [
            ((x0_out, y0_out, z0_out), (x1_out, y1_out, z1_out), (x1_mid, y1_mid, z1_mid), (x0_mid, y0_mid, z0_mid)),
            ((x0_mid, y0_mid, z0_mid), (x1_mid, y1_mid, z1_mid), (x1_in, y1_in, z1_in), (x0_in, y0_in, z0_in)),
        ]:
            ux, uy, uz = pb[0] - pa[0], pb[1] - pa[1], pb[2] - pa[2]
            vx, vy, vz = pd[0] - pa[0], pd[1] - pa[1], pd[2] - pa[2]
            nx = uy * vz - uz * vy
            ny = uz * vx - ux * vz
            nz = ux * vy - uy * vx
            nl = math.sqrt(nx * nx + ny * ny + nz * nz) or 1.0
            n_vec = (nx / nl, ny / nl, nz / nl)
            base = len(bezel_pos)
            bezel_pos.extend([pa, pb, pc, pd])
            bezel_norm.extend([n_vec, n_vec, n_vec, n_vec])
            bezel_idx.extend([base, base + 1, base + 2, base, base + 2, base + 3])

    append_raw_face(amber_bucket, bezel_pos, bezel_norm, bezel_idx, flip_winding=False)

    # 3. Build the recessed flat Charcoal-Grey TFT Screen (`Screen_Chest_TFT`)
    scr_pos = [(0.0, y_screen_plane, 8.15)]
    scr_norm = [(0.0, -0.982, -0.187)]
    for x_in, z_in in hole_inner_xz:
        y_in = y_screen_plane + (z_in - 8.15) * 0.19
        scr_pos.append((x_in, y_in, z_in))
        scr_norm.append((0.0, -0.982, -0.187))
    scr_idx = []
    for k in range(n_loop):
        k_next = (k + 1) % n_loop
        scr_idx.extend([0, 1 + k_next, 1 + k])

    append_raw_face(screen_bucket, scr_pos, scr_norm, scr_idx, flip_winding=False)

    panel_prims = [
        {"mat_idx": mat_cream, **cream_bucket},
        {"mat_idx": mat_amber, **amber_bucket},
    ]
    screen_prims = [
        {"mat_idx": mat_tft_screen, **screen_bucket},
    ]
    return panel_prims, screen_prims


def build_v24_head_and_collar(glb: GLBBuilder, mat_amber: int, mat_cream: int, mat_seam: int, mat_translucent_black: int):
    """
    Constructs the exact v24 (`165d2249.f3d` / `somo-v4.png`) upper assembly sitting above Body[12] (z=16.72):
      1. Upper extension of `Shell_Main_Amber` (z = 16.72 .. 17.85, r = 9.32 -> 8.95)
      2. White Collar Ring `Light_Ring_Collar` (z = 17.85 .. 18.42, r = 8.95 -> 8.76) with recessed seam grooves
      3. Oblate Amber Head Dome `Head_Dome_Amber` (z = 18.42 .. 22.85, r = 8.76 -> 9.32 -> 4.15) + front-seam sensor port
      4. Circular Cream Top Cap `Head_Dome_Cap` (z = 22.85 .. 23.42, r = 4.15 -> 0.00)
    """
    import numpy as np

    def build_revolved_band(rz_points: list[tuple[float, float]], mat_idx: int, n_theta: int = 96):
        positions = []
        normals = []
        indices = []
        zs = [p[0] for p in rz_points]
        rs = [p[1] for p in rz_points]
        n_rings = len(rz_points)

        for i in range(n_rings):
            z = zs[i]
            r = rs[i]
            if 0 < i < n_rings - 1:
                dz = zs[i + 1] - zs[i - 1]
                dr = rs[i + 1] - rs[i - 1]
            elif i == 0:
                dz = zs[1] - zs[0]
                dr = rs[1] - rs[0]
            else:
                dz = zs[-1] - zs[-2]
                dr = rs[-1] - rs[-2]
            # Outward normal in (r, z) is (dz, -dr)
            n_r = dz
            n_z = -dr
            nl = math.hypot(n_r, n_z) or 1.0
            n_r, n_z = n_r / nl, n_z / nl

            for j in range(n_theta):
                theta = (2.0 * math.pi * j) / n_theta
                ct, st = math.cos(theta), math.sin(theta)
                x, y = r * ct, r * st
                nx, ny, nz = n_r * ct, n_r * st, n_z
                positions.append(transform_pos_f360_to_gltf(x, y, z))
                normals.append(transform_norm_f360_to_gltf(nx, ny, nz))

        for i in range(n_rings - 1):
            for j in range(n_theta):
                j_next = (j + 1) % n_theta
                a = i * n_theta + j
                b = i * n_theta + j_next
                c = (i + 1) * n_theta + j_next
                d = (i + 1) * n_theta + j
                indices.extend([a, b, c, a, c, d])

        return {"mat_idx": mat_idx, "positions": positions, "normals": normals, "indices": indices}

    # 1. Smooth upper torso extension for Shell_Main_Amber from z=16.70 (r=9.32) to z=17.85 (r=8.95)
    torso_rz = [
        (16.68, 9.34),
        (17.05, 9.23),
        (17.45, 9.10),
        (17.82, 8.96),
        (17.85, 8.82),
    ]
    torso_ext_prim = build_revolved_band(torso_rz, mat_amber)

    # 2. White Collar Ring (`light_ring`, z = 17.85 .. 18.42) with inner well sleeve (`well_insert`)
    collar_rz = [
        (17.85, 8.78),
        (17.88, 8.94),
        (18.15, 8.86),
        (18.39, 8.77),
        (18.42, 8.62),
        (18.42, 8.23),
        (17.20, 8.23),
    ]
    collar_prim = build_revolved_band(collar_rz, mat_cream)

    # Dark seam rings at bottom and top of the white collar
    seam_rings = [
        build_revolved_band([(17.83, 8.93), (17.87, 8.93)], mat_seam),
        build_revolved_band([(18.40, 8.76), (18.44, 8.76)], mat_seam),
    ]

    # 3. Smooth Oblate Amber Head Dome (`Head_Dome_Amber`, z = 18.42 .. 22.85, r = 8.76 -> 9.30 -> 4.15)
    # Matches the exact v24 B-Rep curvature of head_cap (BREP.82692439), with underside lip to r=8.18 for head_drum
    dome_rz = [(18.42, 8.18), (18.42, 8.64), (18.45, 8.77)]
    n_dome_steps = 32
    for k in range(1, n_dome_steps + 1):
        t = k / n_dome_steps
        # Parametric smooth oblate dome from (z=18.45, r=8.77) through equator (z=19.65, r=9.30) to (z=22.85, r=4.15)
        ang = -0.34 + t * (1.125 + 0.34)
        # Elliptical meridian centered at z_c = 19.55
        r_val = 9.30 * math.cos(ang)
        z_val = 19.55 + 3.68 * math.sin(ang)
        dome_rz.append((z_val, r_val))

    z_cap_split, r_cap_split = dome_rz[-1]
    dome_prim = build_revolved_band(dome_rz, mat_amber)

    # Small circular camera/sensor port right on the +X seam at the bottom of the amber head dome (as seen in somo-v4.png)
    port_pos = []
    port_norm = []
    port_idx = []
    z_port = 18.92
    r_port_surf = 9.16
    port_rad = 0.27
    n_port = 28
    for i_ring, (rad_scale, x_offset) in enumerate([(1.08, 0.015), (0.82, 0.02), (0.78, -0.04)]):
        for k in range(n_port):
            ang = 2.0 * math.pi * k / n_port
            py = port_rad * rad_scale * math.cos(ang)
            pz = z_port + port_rad * rad_scale * math.sin(ang)
            px = math.sqrt(max(0.1, r_port_surf * r_port_surf - py * py)) + x_offset
            port_pos.append(transform_pos_f360_to_gltf(px, py, pz))
            port_norm.append(transform_norm_f360_to_gltf(1.0, 0.0, 0.0))
    for i_ring in range(2):
        for k in range(n_port):
            k_next = (k + 1) % n_port
            a = i_ring * n_port + k
            b = i_ring * n_port + k_next
            c = (i_ring + 1) * n_port + k_next
            d = (i_ring + 1) * n_port + k
            port_idx.extend([a, b, c, a, c, d])
    port_ring_prim = {"mat_idx": mat_seam, "positions": port_pos, "normals": port_norm, "indices": port_idx}

    # Black translucent cover lens inside the +X seam sensor port
    port_lens_pos = [transform_pos_f360_to_gltf(r_port_surf - 0.01, 0.0, z_port)]
    port_lens_norm = [transform_norm_f360_to_gltf(1.0, 0.0, 0.0)]
    port_lens_idx = []
    for k in range(n_port):
        ang = 2.0 * math.pi * k / n_port
        py = port_rad * 0.80 * math.cos(ang)
        pz = z_port + port_rad * 0.80 * math.sin(ang)
        px = math.sqrt(max(0.1, r_port_surf * r_port_surf - py * py)) - 0.01
        port_lens_pos.append(transform_pos_f360_to_gltf(px, py, pz))
        port_lens_norm.append(transform_norm_f360_to_gltf(1.0, 0.0, 0.0))
    for k in range(n_port):
        k_next = (k + 1) % n_port
        port_lens_idx.extend([0, 1 + k, 1 + k_next])
    port_lens_prim = {"mat_idx": mat_translucent_black, "positions": port_lens_pos, "normals": port_lens_norm, "indices": port_lens_idx}

    # Thin vertical split seam line along the +X meridian across the head dome and torso (matching somo-v4.png)
    def build_meridian_seam(rz_list):
        s_pos = []
        s_norm = []
        s_idx = []
        half_w = 0.028
        for i, (z_v, r_v) in enumerate(rz_list):
            px = r_v + 0.012
            s_pos.append(transform_pos_f360_to_gltf(px, -half_w, z_v))
            s_pos.append(transform_pos_f360_to_gltf(px, +half_w, z_v))
            s_norm.append(transform_norm_f360_to_gltf(1.0, 0.0, 0.3))
            s_norm.append(transform_norm_f360_to_gltf(1.0, 0.0, 0.3))
            if i < len(rz_list) - 1:
                base = i * 2
                s_idx.extend([base, base + 1, base + 3, base, base + 3, base + 2])
        return {"mat_idx": mat_seam, "positions": s_pos, "normals": s_norm, "indices": s_idx}

    dome_seam_prim = build_meridian_seam(dome_rz[2:])
    torso_seam_prim = build_meridian_seam([(14.47, 10.95), (15.60, 10.25), (16.68, 9.34)] + torso_rz[:-1])

    # 4. Circular Cream Top Cap (`Head_Dome_Cap`, r = 4.15 -> 0.00) continuing the exact dome curvature
    cap_rz = []
    n_cap_steps = 16
    for k in range(n_cap_steps + 1):
        t = k / n_cap_steps
        ang = 1.125 + t * (math.pi * 0.5 - 1.125)
        r_val = max(0.001, 9.30 * math.cos(ang))
        z_val = 19.55 + 3.68 * math.sin(ang)
        cap_rz.append((z_val, r_val))
    cap_prim = build_revolved_band(cap_rz, mat_cream)
    cap_groove_prim = build_revolved_band([(z_cap_split - 0.015, r_cap_split + 0.01), (z_cap_split + 0.015, r_cap_split - 0.02)], mat_seam)
    cap_seam_prim = build_meridian_seam(cap_rz)

    return {
        "torso_ext": [torso_ext_prim, torso_seam_prim] + seam_rings + [collar_prim],
        "head_dome": [dome_prim, port_ring_prim, port_lens_prim, dome_seam_prim, cap_groove_prim],
        "head_cap": [cap_prim, cap_seam_prim],
    }


def build_v24_face_Features_and_covers(
    glb: GLBBuilder,
    neck_prims: list[dict],
    mat_cream: int,
    mat_seam: int,
    mat_translucent_black: int,
    mat_inner_dark: int,
):
    """
    Augments `Head_Neck_Visor` with the v24 pop-up face features (`BREP.02790908` in `165d2249.f3d`)
    and covers all openings where internal electronics would be visible with a recessed black translucent
    smoked-glass layer (`SOMO_Translucent_Black`):
      1. Full inner dark cylinder shield (`r = 7.98 cm`, `z = 12.40 .. 18.45`) so no gap or internal electronics
         can ever be seen from outside.
      2. Left & Right Circular `GC9A01` 1.28" Eye Sockets (`cx = ±2.521`, `cy = -6.02`, `cz = 16.155`, `r = 1.28`)
         covered with a dark backing disc + smoked translucent glass lens layer.
      3. v24 Center Circular Camera Opening (`Arducam_B0332`, `x = 0.0`, `z = 16.05`, `r = 0.72 cm`) between the eyes,
         with a sculpted cream bezel, dark inner barrel, and recessed black translucent smoked glass cover.
    """
    # 1. Inner dark cylindrical core shield (r = 5.85 cm, z = 11.50 .. 18.45) to block any view into the torso/head interior
    shield_pos = []
    shield_norm = []
    shield_idx = []
    n_sh = 72
    r_sh = 5.85
    for i_z, z_v in enumerate([11.50, 18.45]):
        for j in range(n_sh):
            ang = 2.0 * math.pi * j / n_sh
            ct, st = math.cos(ang), math.sin(ang)
            shield_pos.append(transform_pos_f360_to_gltf(r_sh * ct, r_sh * st, z_v))
            shield_norm.append(transform_norm_f360_to_gltf(ct, st, 0.0))
    for j in range(n_sh):
        j_next = (j + 1) % n_sh
        a, b = j, j_next
        c, d = n_sh + j_next, n_sh + j
        shield_idx.extend([a, b, c, a, c, d])
    neck_prims.append({"mat_idx": mat_inner_dark, "positions": shield_pos, "normals": shield_norm, "indices": shield_idx})

    # 2. Left & Right Eye Barrels: opaque dark backing disc at y = -6.02 so the GC9A01 OLED eyes at y = -6.78 sit cleanly in front of the backing disc
    eye_back_pos, eye_back_norm, eye_back_idx = [], [], []
    n_eye_seg = 48
    for cx_eye, tilt_sign in [(-2.584, -1.0), (2.571, 1.0)]:
        cz_eye = 16.155
        nx_f = 0.0872 * tilt_sign
        ny_f = -0.9962
        n_gltf = transform_norm_f360_to_gltf(nx_f, ny_f, 0.0)

        base_b = len(eye_back_pos)
        cy_back = -6.02
        eye_back_pos.append(transform_pos_f360_to_gltf(cx_eye, cy_back, cz_eye))
        eye_back_norm.append(n_gltf)
        for k in range(n_eye_seg):
            ang = 2.0 * math.pi * k / n_eye_seg
            dx = 1.25 * math.cos(ang) * 0.9962
            dy = -1.25 * math.cos(ang) * 0.0872 * tilt_sign
            dz = 1.25 * math.sin(ang)
            eye_back_pos.append(transform_pos_f360_to_gltf(cx_eye + dx, cy_back + dy, cz_eye + dz))
            eye_back_norm.append(n_gltf)
        for k in range(n_eye_seg):
            k_next = (k + 1) % n_eye_seg
            eye_back_idx.extend([base_b, base_b + 1 + k, base_b + 1 + k_next])

    neck_prims.append({"mat_idx": mat_seam, "positions": eye_back_pos, "normals": eye_back_norm, "indices": eye_back_idx})

    # Helper to build a raised cream bezel + recessed black translucent smoked-glass cover on the front face cylinder
    bezel_cream_pos, bezel_cream_norm, bezel_cream_idx = [], [], []
    wall_dark_pos, wall_dark_norm, wall_dark_idx = [], [], []
    cover_black_pos, cover_black_norm, cover_black_idx = [], [], []

    def add_cylindrical_recessed_feature(loop_2d_az: list[tuple[float, float]], center_az: tuple[float, float], r_surf: float, bezel_width: float = 0.08):
        """
        loop_2d_az: CCW loop of (arc_x, z) points in cm around center_az = (arc_x_c, z_c),
        where angle phi from front (-Y) is phi = arc_x / r_surf, so:
          x(r, phi) = r * sin(phi)
          y(r, phi) = -r * cos(phi)
        Placed proud of the underlying CAD cylinder (`r_surf`) so there is zero Z-fighting.
        """
        cx_arc, cz = center_az
        n_pts = len(loop_2d_az)

        outer_ring = []
        mid_ring = []
        inner_ring = []
        glass_ring = []

        for ax, az in loop_2d_az:
            dx = ax - cx_arc
            dz = az - cz
            dist = math.hypot(dx, dz) or 1.0
            scale_out = (dist + bezel_width) / dist
            ax_out = cx_arc + dx * scale_out
            az_out = cz + dz * scale_out

            phi_out = ax_out / r_surf
            phi_in = ax / r_surf

            r_out = r_surf + 0.025
            r_mid = r_surf + 0.095
            r_in = r_surf + 0.035
            r_gl = r_surf + 0.065

            outer_ring.append((r_out * math.sin(phi_out), -r_out * math.cos(phi_out), az_out))
            mid_ring.append((r_mid * math.sin(phi_in), -r_mid * math.cos(phi_in), az))
            inner_ring.append((r_in * math.sin(phi_in), -r_in * math.cos(phi_in), az))
            glass_ring.append((r_gl * math.sin(phi_in), -r_gl * math.cos(phi_in), az))

        def add_quad_strip(ring_a, ring_b, pos_list, norm_list, idx_list):
            for k in range(n_pts):
                k_next = (k + 1) % n_pts
                pa, pb = ring_a[k], ring_a[k_next]
                pc, pd = ring_b[k_next], ring_b[k]
                ux, uy, uz = pb[0] - pa[0], pb[1] - pa[1], pb[2] - pa[2]
                vx, vy, vz = pd[0] - pa[0], pd[1] - pa[1], pd[2] - pa[2]
                nx = uy * vz - uz * vy
                ny = uz * vx - ux * vz
                nz = ux * vy - uy * vx
                nl = math.sqrt(nx * nx + ny * ny + nz * nz) or 1.0
                if ny > 0:
                    nx, ny, nz = -nx, -ny, -nz
                gn = transform_norm_f360_to_gltf(nx / nl, ny / nl, nz / nl)
                base = len(pos_list)
                for pt in (pa, pb, pc, pd):
                    pos_list.append(transform_pos_f360_to_gltf(*pt))
                    norm_list.append(gn)
                idx_list.extend([base, base + 1, base + 2, base, base + 2, base + 3])

        # Cream outer chamfer bezel
        add_quad_strip(outer_ring, mid_ring, bezel_cream_pos, bezel_cream_norm, bezel_cream_idx)
        # Dark recessed inner wall
        add_quad_strip(mid_ring, inner_ring, wall_dark_pos, wall_dark_norm, wall_dark_idx)

        # Dark backing plate at r_in
        phi_c = cx_arc / r_surf
        r_in = r_surf + 0.035
        c_back = transform_pos_f360_to_gltf(r_in * math.sin(phi_c), -r_in * math.cos(phi_c), cz)
        n_front = transform_norm_f360_to_gltf(math.sin(phi_c), -math.cos(phi_c), 0.0)
        base_bk = len(wall_dark_pos)
        wall_dark_pos.append(c_back)
        wall_dark_norm.append(n_front)
        for pt in inner_ring:
            wall_dark_pos.append(transform_pos_f360_to_gltf(*pt))
            wall_dark_norm.append(n_front)
        for k in range(n_pts):
            k_next = (k + 1) % n_pts
            wall_dark_idx.extend([base_bk, base_bk + 1 + k, base_bk + 1 + k_next])

        # Black translucent smoked-glass cover lens at r_gl
        r_gl = r_surf + 0.065
        c_gl = transform_pos_f360_to_gltf(r_gl * math.sin(phi_c), -r_gl * math.cos(phi_c), cz)
        base_cv = len(cover_black_pos)
        cover_black_pos.append(c_gl)
        cover_black_norm.append(n_front)
        for pt in glass_ring:
            cover_black_pos.append(transform_pos_f360_to_gltf(*pt))
            cover_black_norm.append(n_front)
        for k in range(n_pts):
            k_next = (k + 1) % n_pts
            cover_black_idx.extend([base_cv, base_cv + 1 + k, base_cv + 1 + k_next])

    # 3. v24 Center Circular Camera Opening (`Arducam_B0332` in BREP.02790908) between the two eyes
    # At x = 0, z = 16.05 on the central visor bridge (r_surf = 7.98)
    n_cam = 36
    r_cam = 0.48
    cam_loop = [(r_cam * math.cos(2.0 * math.pi * k / n_cam), 16.05 + r_cam * math.sin(2.0 * math.pi * k / n_cam)) for k in range(n_cam)]
    add_cylindrical_recessed_feature(cam_loop, (0.0, 16.05), r_surf=7.98, bezel_width=0.07)

    neck_prims.append({"mat_idx": mat_cream, "positions": bezel_cream_pos, "normals": bezel_cream_norm, "indices": bezel_cream_idx})
    neck_prims.append({"mat_idx": mat_seam, "positions": wall_dark_pos, "normals": wall_dark_norm, "indices": wall_dark_idx})
    neck_prims.append({"mat_idx": mat_translucent_black, "positions": cover_black_pos, "normals": cover_black_norm, "indices": cover_black_idx})


def export_somo_full_assembly():
    """
    Builds public/models/somo-assembly.glb using the latest iro_v2 (165d2249-c6b1-4ca9-84d7-4794f1933237.f3d, v24)
    geometry and material palette so the 3D robot matches somo-v4.png down to every detail.
    """
    main_f3d = os.path.join(IRO_DIR, "2c8e076d-55c7-414e-a2ef-b17de71b282a.f3d")
    bodies, w = parse_ogs_bodies(main_f3d)
    mats_lookup = extract_protein_materials(main_f3d)
    by_idx = {b["body_index"]: b for b in bodies}

    glb = GLBBuilder()
    # Exact PBR material palette calibrated to somo-v4.png (165d2249.f3d)
    mat_amber = glb.get_or_add_material("SOMO_Amber_Gold", (0.76, 0.51, 0.16, 1.0), metallic=0.12, roughness=0.32)
    mat_cream = glb.get_or_add_material("SOMO_Warm_Cream", (0.88, 0.87, 0.81, 1.0), metallic=0.04, roughness=0.36)
    mat_tft_screen = glb.get_or_add_material("SOMO_TFT_Obsidian", (0.025, 0.028, 0.036, 1.0), metallic=0.18, roughness=0.14)
    mat_seam = glb.get_or_add_material("SOMO_Seam_Dark", (0.14, 0.12, 0.10, 1.0), metallic=0.10, roughness=0.60)
    mat_translucent_black = glb.get_or_add_material("SOMO_Translucent_Black", (0.02, 0.025, 0.035, 0.88), metallic=0.15, roughness=0.12)
    mat_inner_dark = glb.get_or_add_material("SOMO_Inner_Shield", (0.04, 0.04, 0.05, 1.0), metallic=0.10, roughness=0.85)
    mat_silver = glb.get_or_add_material("SOMO_Chassis_Silver", (0.68, 0.70, 0.74, 1.0), metallic=0.72, roughness=0.32)
    mat_dark_metal = glb.get_or_add_material("SOMO_Dark_Alloy", (0.22, 0.24, 0.28, 1.0), metallic=0.65, roughness=0.38)

    v24_upper = build_v24_head_and_collar(glb, mat_amber, mat_cream, mat_seam, mat_translucent_black)

    # 1. Head_Dome_Amber & Head_Dome_Cap (v24 flush lowered head dome + smaller circular cream cap)
    glb.add_node_primitives("Head_Dome_Amber", v24_upper["head_dome"])
    glb.add_node_primitives("Head_Dome_Cap", v24_upper["head_cap"])

    # 2. Retractable Head_Neck_Visor (`head_drum`, r = 8.22, aligned with bottom of Head_Dome_Amber at z = 18.45)
    body6 = by_idx[6]
    keep_cream_fids = {9, 10, 11, 12, 13, 46, 49, 52, 221}
    neck_faces = [f for f in body6["faces"] if f["face_index"] in keep_cream_fids]
    mat_neck_visor = [
        1.0, 0.0, 0.0, 0.0,
        0.0, 1.0, 0.0, 0.0,
        0.0, 0.0, 1.0, 0.0,
        0.0, 0.0, 1.45, 1.0,
    ]
    neck_prims = combine_bodies_into_primitives(
        glb,
        [{"body_index": 6, "faces": neck_faces}],
        mats_lookup,
        mat4=mat_neck_visor,
        override_mat_fn=lambda *_: mat_cream,
    )
    build_v24_face_Features_and_covers(
        glb,
        neck_prims,
        mat_cream,
        mat_seam,
        mat_translucent_black,
        mat_inner_dark,
    )
    glb.add_node_primitives("Head_Neck_Visor", neck_prims)

    # 3. Four Arched Cream Panels (with v24 clean Front Panel + Amber Bezel + Charcoal TFT Screen)
    front_panel_prims, chest_screen_prims = build_v24_front_panel_and_screen(
        glb, by_idx[8], mat_cream, mat_amber, mat_tft_screen
    )
    glb.add_node_primitives("Panel_Front_Cream", front_panel_prims)
    glb.add_node_primitives("Screen_Chest_TFT", chest_screen_prims)

    glb.add_node_primitives(
        "Panel_Left_Cream",
        combine_bodies_into_primitives(glb, [by_idx[8]], mats_lookup, override_mat_fn=lambda *_: mat_cream),
    )
    glb.add_node_primitives(
        "Panel_Right_Cream",
        combine_bodies_into_primitives(glb, [by_idx[10]], mats_lookup, override_mat_fn=lambda *_: mat_cream),
    )

    # Cover the circular cable/port opening on Panel_Back_Cream (Body[11] face[7]: x in [-1, 1], y in [13.38, 13.98], z in [1.50, 3.50])
    # with an opaque dark backing plate + black translucent smoked-glass layer, plus a solid bottom base disc at z = -0.35
    back_prims = combine_bodies_into_primitives(glb, [by_idx[11]], mats_lookup, override_mat_fn=lambda *_: mat_cream)
    back_back_pos, back_back_norm, back_back_idx = [], [], []
    back_glass_pos, back_glass_norm, back_glass_idx = [], [], []
    n_bk = 40
    cz_bk = 2.50
    r_bk = 1.04
    n_back_gltf = transform_norm_f360_to_gltf(0.0, 1.0, 0.0)

    # Opaque dark backing disc at y = 13.35 + bottom base cap at z = -0.35 (r = 12.6) so no interior is visible from any angle
    back_back_pos.append(transform_pos_f360_to_gltf(0.0, 13.35, cz_bk))
    back_back_norm.append(n_back_gltf)
    for k in range(n_bk):
        ang = 2.0 * math.pi * k / n_bk
        px = r_bk * math.cos(ang)
        pz = cz_bk + r_bk * math.sin(ang)
        back_back_pos.append(transform_pos_f360_to_gltf(px, 13.35, pz))
        back_back_norm.append(n_back_gltf)
    for k in range(n_bk):
        k_next = (k + 1) % n_bk
        back_back_idx.extend([0, 1 + k_next, 1 + k])

    # Also add a solid dark bottom base disc at z = -0.34 (r = 12.6 cm)
    base_bot = len(back_back_pos)
    n_bot = 64
    n_bot_gltf = transform_norm_f360_to_gltf(0.0, 0.0, -1.0)
    back_back_pos.append(transform_pos_f360_to_gltf(0.0, 0.0, -0.34))
    back_back_norm.append(n_bot_gltf)
    for k in range(n_bot):
        ang = 2.0 * math.pi * k / n_bot
        back_back_pos.append(transform_pos_f360_to_gltf(12.6 * math.cos(ang), 12.6 * math.sin(ang), -0.34))
        back_back_norm.append(n_bot_gltf)
    for k in range(n_bot):
        k_next = (k + 1) % n_bot
        back_back_idx.extend([base_bot, base_bot + 1 + k_next, base_bot + 1 + k])

    # Black translucent smoked-glass cover lens inside the back port at y = 13.78
    back_glass_pos.append(transform_pos_f360_to_gltf(0.0, 13.78, cz_bk))
    back_glass_norm.append(n_back_gltf)
    for k in range(n_bk):
        ang = 2.0 * math.pi * k / n_bk
        px = r_bk * math.cos(ang)
        pz = cz_bk + r_bk * math.sin(ang)
        back_glass_pos.append(transform_pos_f360_to_gltf(px, 13.78, pz))
        back_glass_norm.append(n_back_gltf)
    for k in range(n_bk):
        k_next = (k + 1) % n_bk
        back_glass_idx.extend([0, 1 + k_next, 1 + k])

    back_prims.append({"mat_idx": mat_inner_dark, "positions": back_back_pos, "normals": back_back_norm, "indices": back_back_idx})
    back_prims.append({"mat_idx": mat_translucent_black, "positions": back_glass_pos, "normals": back_glass_norm, "indices": back_glass_idx})
    glb.add_node_primitives("Panel_Back_Cream", back_prims)

    # 4. Main Amber 4-Arch Body Shell + v24 Upper Torso & White Collar Ring (Light_Ring_Collar)
    body12_prims = combine_bodies_into_primitives(glb, [by_idx[12]], mats_lookup, override_mat_fn=lambda *_: mat_amber)
    glb.add_node_primitives("Shell_Main_Amber", body12_prims + v24_upper["torso_ext"])

    # 5. Internal Chassis & Base Plate (tucked cleanly inside the lower body shell)
    chassis_bodies = [by_idx[k] for k in [13, 14, 15, 17, 19, 68, 69, 70, 71] if k in by_idx]
    chassis_prims = combine_bodies_into_primitives(
        glb,
        chassis_bodies,
        mats_lookup,
        override_mat_fn=lambda g, b_i, f, ml: mat_dark_metal if b_i in (13, 17, 68, 69, 70) else mat_silver,
    )
    glb.add_node_primitives("Internal_Chassis", chassis_prims)

    # 6. Helper to read an Instance 4x4 transform matrix from `world`
    def get_instance_mat(ipos: int) -> list[float]:
        tpos = w.rfind("TransformAttribute\x00".encode("utf-16le"), max(0, ipos - 300), ipos)
        return list(struct.unpack("<16f", w[tpos + 41 : tpos + 41 + 64]))

    # 7. Dual GC9A01 Round Eye Displays (retracted inside the upper body along with Head_Neck_Visor)
    gc9a01_bodies = [by_idx[k] for k in range(27, 68) if k in by_idx]
    mat_left_eye = get_instance_mat(5909675)
    mat_left_eye[14] -= 6.8
    mat_right_eye = get_instance_mat(6333530)
    mat_right_eye[14] -= 6.8

    glb.add_node_primitives(
        "Eye_Left_GC9A01",
        combine_bodies_into_primitives(glb, gc9a01_bodies, mats_lookup, mat4=mat_left_eye),
    )
    glb.add_node_primitives(
        "Eye_Right_GC9A01",
        combine_bodies_into_primitives(glb, gc9a01_bodies, mats_lookup, mat4=mat_right_eye),
    )

    # 8. Internal Arducam B0332 Camera (tucked inside the head assembly behind the front seam port)
    cam_bodies, _ = parse_ogs_bodies(os.path.join(IRO_DIR, "7fcd840a-b23b-44ad-b186-0fed7eaac5d4.zip.f3d"))
    mat_cam = get_instance_mat(6684919)
    mat_cam[13] += 4.5
    mat_cam[14] += 5.0
    mat_cam_lens = glb.get_or_add_material("Camera_Lens_Dark", (0.12, 0.14, 0.18, 1.0), 0.45, 0.22)
    glb.add_node_primitives(
        "Sensor_Camera_Arducam",
        combine_bodies_into_primitives(glb, cam_bodies, mats_lookup, mat4=mat_cam, override_mat_fn=lambda *_: mat_cam_lens),
    )

    # 9. Internal INMP441 I2S Microphone (tucked inside the upper body)
    mic_f3d = os.path.join(IRO_DIR, "9b94f29b-b387-4491-a198-e4171894c788.zip.f3d")
    mic_bodies, _ = parse_ogs_bodies(mic_f3d)
    mic_mats = extract_protein_materials(mic_f3d)
    mat_mic = get_instance_mat(7181054)
    mat_mic[13] += 4.2
    mat_mic[14] += 5.0
    glb.add_node_primitives(
        "Sensor_Mic_INMP441",
        combine_bodies_into_primitives(glb, mic_bodies, mic_mats, mat4=mat_mic),
    )

    # 10. Internal Linear Actuator
    act_f3d = os.path.join(IRO_DIR, "f3f598f1-e59e-41fc-8a61-ceb7cf9652ab.f3d")
    act_bodies, _ = parse_ogs_bodies(act_f3d)
    mat_act = [
        0.0, 0.0, 1.0, 0.0,
        0.0, 1.0, 0.0, 0.0,
        -1.0, 0.0, 0.0, 0.0,
        0.0, 0.0, 4.5, 1.0,
    ]
    glb.add_node_primitives(
        "Drive_Linear_Actuator",
        combine_bodies_into_primitives(glb, act_bodies, mats_lookup, mat4=mat_act, override_mat_fn=lambda *_: mat_dark_metal),
    )

    # 12. Internal Raspberry Pi 5 positioned on the Pi 5 standoffs (Body[14, 15]: x in -4..4, y in 3..7.5, z = 2.0)
    rpi_mat4 = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0.0, 5.2, 2.2, 1.0]
    glb.add_node_primitives("Compute_Raspberry_Pi_5", extract_raspberry_pi_5_primitives(glb, mat4=rpi_mat4))

    glb.save_glb(os.path.join(OUT_MODELS_DIR, "somo-assembly.glb"))

    # Also export the internal optical visor sub-assembly (Body[0, 2, 5]) as somo-head-visor.glb
    visor_glb = GLBBuilder()
    visor_bodies = [by_idx[0], by_idx[2], by_idx[5]]
    all_v_pts = [p for b in visor_bodies for f in b["faces"] for p in f["positions"]]
    vcx = (min(p[0] for p in all_v_pts) + max(p[0] for p in all_v_pts)) / 2.0
    vcy = (min(p[1] for p in all_v_pts) + max(p[1] for p in all_v_pts)) / 2.0
    vcz = (min(p[2] for p in all_v_pts) + max(p[2] for p in all_v_pts)) / 2.0
    v_mat4 = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, -vcx, -vcy, -vcz, 1.0]
    visor_glb.add_node_primitives(
        "SOMO_Optical_Visor",
        combine_bodies_into_primitives(visor_glb, visor_bodies, mats_lookup, mat4=v_mat4),
    )
    visor_glb.save_glb(os.path.join(OUT_MODELS_DIR, "somo-head-visor.glb"))


def export_standalone_rpi5():
    glb = GLBBuilder()
    glb.add_node_primitives("Raspberry_Pi_5", extract_raspberry_pi_5_primitives(glb, mat4=None))
    glb.save_glb(os.path.join(OUT_MODELS_DIR, "raspberry-pi-5.glb"))


if __name__ == "__main__":
    print("=== Extracting Preview PNGs ===")
    extract_preview_pngs()
    print("=== Exporting SOMO Full Assembly GLB ===")
    export_somo_full_assembly()
    print("=== Exporting Standalone Component GLBs ===")
    export_standalone_component_glb("eb39b3f2-fab6-4a42-9353-6307bc7b0a09.zip.f3d", "gc9a01-display.glb")
    export_standalone_component_glb("6727d270-3e2f-470e-9756-1819064eca93.zip.f3d", "featherwing-tft.glb")
    export_standalone_component_glb("9b94f29b-b387-4491-a198-e4171894c788.zip.f3d", "inmp441-mic.glb")
    export_standalone_component_glb("7fcd840a-b23b-44ad-b186-0fed7eaac5d4.zip.f3d", "arducam-b0332.glb")
    export_standalone_component_glb("f3f598f1-e59e-41fc-8a61-ceb7cf9652ab.f3d", "linear-actuator.glb")
    export_standalone_rpi5()
    print("=== Done! ===")
