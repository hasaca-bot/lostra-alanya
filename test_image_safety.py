"""Security and privacy checks for uploaded image decoding."""
from io import BytesIO
import unittest
from unittest.mock import patch

from PIL import Image, PngImagePlugin

import image_safety


def picture(image_format="PNG", **options):
    image = Image.new("RGB", (12, 8), (90, 130, 180))
    output = BytesIO()
    image.save(output, format=image_format, **options)
    return output.getvalue()


class ImageSafetyTests(unittest.TestCase):
    def test_supported_formats_decode_again(self):
        for fmt, extension in (("JPEG", "jpg"), ("PNG", "png"), ("WEBP", "webp")):
            with self.subTest(fmt=fmt):
                data, actual_extension = image_safety.validate_image(picture(fmt))
                self.assertEqual(actual_extension, extension)
                with Image.open(BytesIO(data)) as image:
                    image.load()
                    self.assertEqual(image.size, (12, 8))
                    self.assertEqual(image.format, fmt)

    def test_invalid_spoofed_and_truncated_files(self):
        samples = [b"", b"not an image", b"\x89PNG\r\n\x1a\n<html>bad</html>",
                   picture("PNG")[:-15], picture("JPEG")[:-30], picture("WEBP")[:-10],
                   picture("GIF")]
        for sample in samples:
            with self.subTest(size=len(sample)):
                with self.assertRaises(ValueError):
                    image_safety.validate_image(sample)

    def test_metadata_and_appended_payload_removed(self):
        metadata = PngImagePlugin.PngInfo()
        metadata.add_text("GPS", "PRIVATE_LOCATION_12345")
        data = picture(pnginfo=metadata) + b"<script>APPENDED_PAYLOAD</script>"
        safe, _ = image_safety.validate_image(data)
        self.assertNotIn(b"PRIVATE_LOCATION", safe)
        self.assertNotIn(b"APPENDED_PAYLOAD", safe)
        with Image.open(BytesIO(safe)) as image:
            self.assertEqual(image.info, {})

    def test_exif_orientation_applied_and_metadata_stripped(self):
        exif = Image.Exif()
        exif[274] = 6  # rotate 90 degrees clockwise
        exif[270] = "PRIVATE_CUSTOMER_METADATA"
        safe, _ = image_safety.validate_image(picture("JPEG", exif=exif))
        with Image.open(BytesIO(safe)) as image:
            self.assertEqual(image.size, (8, 12))
            self.assertFalse(image.getexif())
        self.assertNotIn(b"PRIVATE_CUSTOMER_METADATA", safe)

    def test_transparency_preserved(self):
        for fmt in ("PNG", "WEBP"):
            with self.subTest(fmt=fmt):
                source = Image.new("RGBA", (3, 3), (100, 200, 50, 80))
                output = BytesIO()
                source.save(output, format=fmt)
                safe, _ = image_safety.validate_image(output.getvalue())
                with Image.open(BytesIO(safe)) as image:
                    self.assertEqual(image.convert("RGBA").getpixel((1, 1))[3], 80)

    def test_animated_png_rejected(self):
        output = BytesIO()
        first = Image.new("RGB", (4, 4), "red")
        second = Image.new("RGB", (4, 4), "blue")
        first.save(output, format="PNG", save_all=True, append_images=[second], duration=100)
        with self.assertRaisesRegex(ValueError, "Hareketli"):
            image_safety.validate_image(output.getvalue())

    def test_decoded_and_stored_size_limits(self):
        with patch.object(image_safety, "MAX_IMAGE_PIXELS", 90):
            with self.assertRaisesRegex(ValueError, "megapiksel"):
                image_safety.validate_image(picture())
        with patch.object(image_safety, "MAX_IMAGE_DIMENSION", 10):
            with self.assertRaisesRegex(ValueError, "megapiksel"):
                image_safety.validate_image(picture())
        # A compact palette source expands on RGB output; bound the saved result.
        source = Image.new("P", (12, 8))
        output = BytesIO()
        source.save(output, format="PNG", bits=1)
        original = output.getvalue()
        with patch.object(image_safety, "MAX_STORED_IMAGE_BYTES", len(original)):
            # Select an encoding that demonstrably expands instead of assuming it.
            with patch.object(image_safety.Image.Image, "save", side_effect=lambda out, **kw: out.write(b"x" * (len(original) + 1))):
                with self.assertRaisesRegex(ValueError, "İşlenen"):
                    image_safety.validate_image(original)


if __name__ == "__main__":
    unittest.main()
