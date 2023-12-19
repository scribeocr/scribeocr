

describe('It recognises and downloads a', () => {
  beforeEach(() => {
    cy.visit('/');
  })

  it('text file from a jpg with no imported ocr data', () => {
    cy.get('#openFileInput').selectFile(['cypress/fixtures/multi_jpg/aurelia.jpg'], { force: true })
    cy.waitImport()

    cy.get('#nav-recognize-tab').click()
    cy.wait(250)
    cy.get('#recognizeAll').click()

    // cy.wait(10000)
    cy.waitRecognizeAll()
    cy.get('#nav-download-tab').click()
    cy.wait(250)
    cy.get('#downloadFormat').click()
    cy.get('#formatLabelOptionText').click()
    cy.wait(250)
    cy.get('#download').click()
    cy.verifyDownload('aurelia.txt', { contains: true })
  })

  it('text file from a png with no imported ocr data', () => {
    cy.get('#openFileInput').selectFile(['cypress/fixtures/multi_png/aurelia.png'], { force: true })
    cy.waitImport()


    cy.get('#nav-recognize-tab').click()
    cy.wait(250)
    cy.get('#recognizeAll').click()
    cy.waitRecognizeAll()
    cy.get('#nav-download-tab').click()
    cy.wait(250)
    cy.get('#downloadFormat').click()
    cy.get('#formatLabelOptionText').click()
    cy.wait(250)
    cy.get('#download').click()
    cy.verifyDownload('aurelia.txt')
  })

  it('text file from 4 pngs with no imported ocr data', () => {
    cy.get('#openFileInput').selectFile([
      'cypress/fixtures/multi_png/henreys_grave.png',
      'cypress/fixtures/multi_png/aurelia.png',
      'cypress/fixtures/multi_png/the_past.png',
      'cypress/fixtures/pretty_faces.png'
    ], { force: true })
    cy.waitImport()


    cy.get('#nav-recognize-tab').click()
    cy.wait(250)
    cy.get('#recognizeAll').click()
    cy.waitRecognizeAll()
    cy.get('#nav-download-tab').click()
    cy.wait(250)
    cy.get('#downloadFormat').click()
    cy.get('#formatLabelOptionText').click()
    cy.wait(250)
    cy.get('#download').click()
    cy.verifyDownload('henreys_grave.txt')
  })

  it('pdf file from a png with no imported ocr data, NATIVE', () => {
    cy.get('#openFileInput').selectFile(['cypress/fixtures/multi_png/the_past.png'], { force: true })
    cy.waitImport()

    cy.get('#nav-recognize-tab').click()
    cy.wait(250)
    cy.get('#recognizeAll').click()
    cy.waitRecognizeAll()
    cy.get('#nav-view-tab').click()
    cy.wait(250)
    cy.get('#colorMode').select('Native')

    cy.get('#nav-download-tab').click()
    cy.wait(250)
    cy.get('#downloadFormat').click()
    cy.get('#formatLabelOptionPDF').click()
    cy.wait(250)
    cy.get('#download').click()
    cy.verifyDownload('the_past.pdf')
  })

  it('pdf file from a png with no imported ocr data, BINARY', () => {
    cy.get('#openFileInput').selectFile(['cypress/fixtures/multi_png/the_past.png'], { force: true })
    cy.waitImport()

    cy.get('#nav-recognize-tab').click()
    cy.wait(250)
    cy.get('#recognizeAll').click()
    cy.waitRecognizeAll()
    cy.get('#nav-view-tab').click()
    cy.wait(250)
    cy.get('#colorMode').select('Binary')

    cy.get('#nav-download-tab').click()
    cy.wait(250)
    cy.get('#downloadFormat').click()
    cy.get('#formatLabelOptionPDF').click()
    cy.wait(250)
    cy.get('#download').click()
    cy.verifyDownload('the_past.pdf')
  })

  it('pdf file from 4 pngs with no imported ocr data', () => {
    cy.get('#openFileInput').selectFile([
      'cypress/fixtures/multi_png/aurelia.png',
      'cypress/fixtures/multi_png/henreys_grave.png',
      'cypress/fixtures/multi_png/the_past.png',
      'cypress/fixtures/pretty_faces.png'
    ], { force: true })
    cy.waitImport()

    cy.get('#nav-recognize-tab').click()
    cy.wait(250)
    cy.get('#recognizeAll').click()
    cy.waitRecognizeAll()

    cy.get('#nav-download-tab').click()
    cy.wait(250)
    cy.get('#downloadFormat').click()
    cy.get('#formatLabelOptionPDF').click()
    cy.wait(250)
    cy.get('#download').click()
    cy.verifyDownload('aurelia.pdf')
  })

  it('hocr file from a png with no imported ocr data', () => {
    cy.get('#openFileInput').selectFile(['cypress/fixtures/pretty_faces.png'], { force: true })
    cy.waitImport()

    cy.get('#nav-recognize-tab').click()
    cy.wait(250)
    cy.get('#recognizeAll').click()
    cy.waitRecognizeAll()
    cy.get('#nav-download-tab').click()
    cy.wait(250)
    cy.get('#downloadFormat').click()
    cy.get('#formatLabelOptionHOCR').click()
    cy.wait(250)
    cy.get('#download').click()
    cy.verifyDownload('pretty_faces.hocr')
  })

  it('text file from 4 pngs with no imported ocr data', () => {
    cy.get('#openFileInput').selectFile([
      'cypress/fixtures/multi_png/the_past.png',
      'cypress/fixtures/multi_png/henreys_grave.png',
      'cypress/fixtures/multi_png/aurelia.png',
      'cypress/fixtures/pretty_faces.png',
    ], { force: true })
    cy.waitImport()

    cy.get('#nav-recognize-tab').click()
    cy.wait(250)
    cy.get('#recognizeAll').click()
    cy.waitRecognizeAll()
    cy.get('#nav-download-tab').click()
    cy.wait(250)
    cy.get('#downloadFormat').click()
    cy.get('#formatLabelOptionHOCR').click()
    cy.wait(250)
    cy.get('#download').click()
    cy.verifyDownload('the_past.hocr')
  })

})