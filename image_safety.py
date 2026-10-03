"""Decode uploaded pictures and store only fresh pixels, without private metadata."""
from io import BytesIO

from PIL import Image, ImageOps, UnidentifiedImageError


MAX_IMAGE_BYTES = 5 * 1024 * 1024
MAX_IMAGE_PIXELS = 25_000_000
MAX_IMAGE_DIMENSION = 10_000
FORMATS = {"JPEG": "jpg", "PNG": "png", "WEBP": "webp"}


class _ImageLimitError(ValueError):
    """Already localized validation failure, distinct from decoder errors."""


def validate_image(data: bytes) -> tuple[bytes, str]:
    """Return (sanitized image bytes, extension); reject unsafe/invalid uploads.

    Both encoded sizes and decoded dimensions are bounded. Re-encoding removes
    EXIF/GPS, comments, embedded thumbnails and appended data. Orientation is
    applied to pixels before metadata is discarded. No filesystem is touched.
    """
    if not isinstance(data, bytes) or not data:
        raise ValueError("Geçerli bir JPG, PNG veya WebP görseli seçin.")
    if len(data) > MAX_IMAGE_BYTES:
        raise ValueError("Her görsel en fazla 5 MB olabilir.")
    try:
        with Image.open(BytesIO(data), formats=list(FORMATS)) as probe:
            image_format = probe.format
            width, height = probe.size
            if (width < 1 or height < 1 or width > MAX_IMAGE_DIMENSION
                    or height > MAX_IMAGE_DIMENSION
                    or width * height > MAX_IMAGE_PIXELS):
                raise _ImageLimitError("Görsel en fazla 25 megapiksel ve her kenarı en fazla 10.000 piksel olabilir.")
            if getattr(probe, "is_animated", False) or getattr(probe, "n_frames", 1) > 1:
                raise _ImageLimitError("Hareketli görseller desteklenmiyor. Sabit bir görsel seçin.")
            probe.verify()

        # verify() does not decode pixel data, so reopen and load in full too.
        with Image.open(BytesIO(data), formats=list(FORMATS)) as source:
            source.load()
            oriented = ImageOps.exif_transpose(source)
            alpha = "A" in oriented.getbands() or "transparency" in oriented.info
            mode = "RGBA" if alpha and image_format != "JPEG" else "RGB"
            converted = oriented.convert(mode)
            oriented.close()
            source.close()
            # A fresh Image guarantees no inherited metadata reaches the encoder.
            clean = Image.new(mode, converted.size)
            clean.paste(converted)
            converted.close()
            output = BytesIO()
            options = {"quality": 95, "subsampling": 0} if image_format == "JPEG" else {}
            if image_format == "WEBP":
                options = {"quality": 95, "method": 4}
            clean.save(output, format=image_format, **options)
            result = output.getvalue()
            clean.close()
    except _ImageLimitError:
        raise
    except (UnidentifiedImageError, OSError, SyntaxError, EOFError, KeyError, ValueError,
            TypeError, Image.DecompressionBombError) as exc:
        raise ValueError("Görsel okunamadı veya dosya bozuk. Geçerli bir JPG, PNG veya WebP seçin.") from exc
    if len(result) > MAX_IMAGE_BYTES:
        raise ValueError("İşlenen görsel 5 MB sınırını aşıyor. Daha küçük bir görsel seçin.")
    return result, FORMATS[image_format]
