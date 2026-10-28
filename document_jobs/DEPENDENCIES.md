# Original worker dependencies

No example code was copied. Package versions were checked against PyPI on
2026-10-27. The Modal image uses Python 3.12 and the pins in requirements.txt.

- pypdfium2 5.14.0: Apache-2.0 or BSD-3-Clause; bundled PDFium and third-party
  notices ship with the package. https://github.com/pypdfium2-team/pypdfium2
- Pillow 13.0.0: MIT-CMU. https://github.com/python-pillow/Pillow
- Modal 1.6.2: Apache-2.0 SDK. https://github.com/modal-labs/modal-client
- Tesseract: Apache-2.0; Debian's tesseract-ocr and English language package
  installed in the Modal image. https://github.com/tesseract-ocr/tesseract

Additional output limits: 2 MB PNG/page and 16 MB review bundle/job, with failed
page locators rather than silent omission. These protect the 1 GiB worker and
transport from compressed input that expands into huge review artifacts.
