const httpServer = Cypress.env('TESTSITE');

describe('It downloads a', () => {
  beforeEach(() => {
    cy.visit(httpServer);
  })

  it('text file from a png with hOCR', () => {
    cy.get('#openFileInput').selectFile(['cypress/fixtures/pretty_faces.xml', 'cypress/fixtures/pretty_faces.png'], { force: true })
    cy.waitImport()
    cy.get('#nav-download-tab').click()
    cy.wait(250)
    cy.get('#downloadFormat').click()
    cy.get('#formatLabelOptionText').click()
    cy.wait(250)
    cy.get('#download').click()
    cy.verifyDownload('pretty_faces.txt', { contains: true })
  })

  it('text file from 4 pngs with 4 hOCRs', () => {
    cy.get('#openFileInput').selectFile([
      'cypress/fixtures/pretty_faces.png',
      'cypress/fixtures/pretty_faces.xml',
      'cypress/fixtures/multi_png/aurelia_png.xml',
      'cypress/fixtures/multi_png/aurelia.png',
      'cypress/fixtures/multi_png/henreys_grave_png.xml',
      'cypress/fixtures/multi_png/henreys_grave.png',
      'cypress/fixtures/multi_png/the_past_png.xml',
      'cypress/fixtures/multi_png/the_past.png'], { force: true })
    cy.waitImport()
    cy.get('#nav-download-tab').click()
    cy.wait(250)
    cy.get('#downloadFormat').click()
    cy.get('#formatLabelOptionText').click()
    cy.wait(250)
    cy.get('#download').click()
    cy.verifyDownload('pretty_faces.txt', { contains: true })
  })

  it('pdf file from a png with hOCR, BINARY', () => {
    cy.get('#openFileInput').selectFile(['cypress/fixtures/pretty_faces.xml', 'cypress/fixtures/pretty_faces.png'], { force: true })
    cy.waitImport()
    cy.get('#nav-view-tab').click()
    cy.wait(250)
    cy.get('#colorMode').select('Binary')

    cy.get('#nav-download-tab').click()
    cy.wait(250)
    cy.get('#downloadFormat').click()
    cy.get('#formatLabelOptionPDF').click()
    cy.wait(250)
    cy.get('#download').click()
    cy.wait(1000)
    cy.verifyDownload('pretty_faces.pdf', { contains: true })
  })

  it('pdf file from a png with hOCR, NATIVE', () => {
    cy.get('#openFileInput').selectFile(['cypress/fixtures/pretty_faces.xml', 'cypress/fixtures/pretty_faces.png'], { force: true })
    cy.waitImport()

    cy.get('#nav-view-tab').click()
    cy.wait(250)
    cy.get('#colorMode').select('Native')

    cy.get('#nav-download-tab').click()
    cy.wait(250)
    cy.get('#downloadFormat').click()
    cy.get('#formatLabelOptionPDF').click()
    cy.wait(250)
    cy.get('#download').click()
    cy.wait(1000)
    cy.verifyDownload('pretty_faces.pdf', { contains: true })
  })

  it('pdf file from 4 pngs with 4 hOCRs', () => {
    cy.get('#openFileInput').selectFile([
      'cypress/fixtures/pretty_faces.xml',
      'cypress/fixtures/pretty_faces.png',
      'cypress/fixtures/multi_png/aurelia_png.xml',
      'cypress/fixtures/multi_png/aurelia.png',
      'cypress/fixtures/multi_png/henreys_grave_png.xml',
      'cypress/fixtures/multi_png/henreys_grave.png',
      'cypress/fixtures/multi_png/the_past_png.xml',
      'cypress/fixtures/multi_png/the_past.png'], { force: true })
    cy.waitImport()
    cy.get('#nav-download-tab').click()
    cy.wait(250)
    cy.get('#downloadFormat').click()
    cy.get('#formatLabelOptionPDF').click()
    cy.wait(250)
    cy.get('#download').click()
    cy.verifyDownload('pretty_faces.pdf', { contains: true })
  })

  it('hocr file from png)', () => {
    cy.get('#openFileInput').selectFile(['cypress/fixtures/pretty_faces.xml', 'cypress/fixtures/pretty_faces.png'], { force: true })
    cy.waitImport()
    cy.get('#nav-download-tab').click()
    cy.wait(250)
    cy.get('#downloadFormat').click()
    cy.get('#formatLabelOptionHOCR').click()
    cy.wait(250)
    cy.get('#download').click()
    cy.verifyDownload('pretty_faces.hocr', { contains: true })

  })

  it('hocr file from 4 pngs)', () => {
    cy.get('#openFileInput').selectFile([
      'cypress/fixtures/pretty_faces.xml',
      'cypress/fixtures/pretty_faces.png',
      'cypress/fixtures/multi_png/aurelia_png.xml',
      'cypress/fixtures/multi_png/aurelia.png',
      'cypress/fixtures/multi_png/henreys_grave_png.xml',
      'cypress/fixtures/multi_png/henreys_grave.png',
      'cypress/fixtures/multi_png/the_past_png.xml',
      'cypress/fixtures/multi_png/the_past.png'
    ], { force: true })
    cy.waitImport()
    cy.get('#nav-download-tab').click()
    cy.wait(250)
    cy.get('#downloadFormat').click()
    cy.get('#formatLabelOptionHOCR').click()
    cy.wait(250)
    cy.get('#download').click()
    cy.verifyDownload('pretty_faces.hocr', { contains: true })

  })

})
