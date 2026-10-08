declare module "heic-convert" {
  export default function convert(options: {
    buffer: Uint8Array | Buffer | ArrayBuffer;
    format: "JPEG" | "PNG";
    quality?: number;
  }): Promise<Uint8Array>;
}
