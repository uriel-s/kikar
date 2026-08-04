/**
 * Identifies an image by its actual bytes.
 *
 * multer's fileFilter can only see the Content-Type the client put on the
 * multipart part, which is just a string the uploader chose — declaring
 * `image/png` while sending an archive passes it. Sniffing the leading bytes is
 * what makes the "only images" rule true rather than advisory.
 *
 * Returns the detected MIME type, or null if the buffer is not one of the
 * formats we accept.
 */
const startsWith = (buffer, bytes, offset = 0) =>
  buffer.length >= offset + bytes.length &&
  bytes.every((byte, index) => buffer[offset + index] === byte);

const SIGNATURES = [
  // SOI marker followed by the first segment marker.
  { mime: "image/jpeg", test: (b) => startsWith(b, [0xff, 0xd8, 0xff]) },
  {
    mime: "image/png",
    test: (b) => startsWith(b, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  },
  {
    // RIFF container whose form type is WEBP: "RIFF" .... "WEBP"
    mime: "image/webp",
    test: (b) =>
      startsWith(b, [0x52, 0x49, 0x46, 0x46]) &&
      startsWith(b, [0x57, 0x45, 0x42, 0x50], 8),
  },
];

const detectImageType = (buffer) => {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    return null;
  }
  return SIGNATURES.find((signature) => signature.test(buffer))?.mime ?? null;
};

module.exports = { detectImageType };
