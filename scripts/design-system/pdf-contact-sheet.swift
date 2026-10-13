// Renders every page of a PDF (for example a story-screenshot-compare.mjs "pdf" capture) into one
// PNG contact sheet so paged print output can be inspected visually. macOS only (PDFKit/AppKit).
//
//   swift scripts/design-system/pdf-contact-sheet.swift <input.pdf> <output.png> [columns=4] [pageWidthPx=420]
//
// Pages are laid out left-to-right with a 16px gutter and a 1px grey page edge; the sheet is evidence
// for pagination, margins and break placement, not a substitute for opening the PDF at full size.
import AppKit
import PDFKit

let arguments = CommandLine.arguments
guard arguments.count >= 3, let document = PDFDocument(url: URL(fileURLWithPath: arguments[1])) else {
  print("Usage: swift pdf-contact-sheet.swift <input.pdf> <output.png> [columns=4] [pageWidthPx=420]")
  exit(arguments.contains("--help") ? 0 : 1)
}
let columns = max(1, arguments.count > 3 ? Int(arguments[3]) ?? 4 : 4)
let pageWidth = CGFloat(arguments.count > 4 ? Double(arguments[4]) ?? 420 : 420)
let gutter: CGFloat = 16
let pages = (0..<document.pageCount).compactMap { document.page(at: $0) }
guard let first = pages.first else { exit(1) }
let bounds = first.bounds(for: .mediaBox)
let scale = pageWidth / bounds.width
let pageHeight = (bounds.height * scale).rounded()
let rows = (pages.count + columns - 1) / columns
let width = Int(gutter + CGFloat(min(columns, pages.count)) * (pageWidth + gutter))
let height = Int(gutter + CGFloat(rows) * (pageHeight + gutter))
guard
  let context = CGContext(
    data: nil, width: width, height: height, bitsPerComponent: 8, bytesPerRow: 0,
    space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)
else { exit(1) }
context.setFillColor(CGColor(gray: 0.82, alpha: 1))
context.fill(CGRect(x: 0, y: 0, width: width, height: height))
for (index, page) in pages.enumerated() {
  let column = CGFloat(index % columns)
  let row = CGFloat(index / columns)
  let x = gutter + column * (pageWidth + gutter)
  let y = CGFloat(height) - gutter - pageHeight - row * (pageHeight + gutter)
  let frame = CGRect(x: x, y: y, width: pageWidth, height: pageHeight)
  context.setFillColor(CGColor(gray: 1, alpha: 1))
  context.fill(frame)
  context.saveGState()
  context.translateBy(x: x, y: y)
  context.scaleBy(x: scale, y: scale)
  page.draw(with: .mediaBox, to: context)
  context.restoreGState()
  context.setStrokeColor(CGColor(gray: 0.55, alpha: 1))
  context.stroke(frame, width: 1)
}
guard let image = context.makeImage() else { exit(1) }
let output = NSBitmapImageRep(cgImage: image).representation(using: .png, properties: [:])
try output?.write(to: URL(fileURLWithPath: arguments[2]))
print("\(pages.count) pages -> \(arguments[2])")
