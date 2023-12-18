const httpServer = Cypress.env('TESTSITE');

describe('It', () => {
  beforeEach(() => {
    cy.visit(httpServer);
  })

  it('downloads a text file from jpg with hOCR (xml for browserstack but data from tess)', () => {
    cy.get('#openFileInput').selectFile([
      'cypress/fixtures/multi_jpg/henreys_grave.xml',
      'cypress/fixtures/multi_jpg/henreys_grave.jpg'
    ], { force: true })
    cy.waitImport()
    cy.get('#nav-download-tab').click()
    cy.wait(250)
    cy.get('#downloadFormat').click()
    cy.get('#formatLabelOptionText').click()
    cy.wait(250)
    cy.get('#download').click()
    cy.verifyDownload('henreys_grave.txt', { contains: true })

  })

  it('downloads a text file from 4 jpgs with 4 hOCRs (xml for browserstack but data from tess)', () => {
    cy.get('#openFileInput').selectFile([
      'cypress/fixtures/snow_drops.xml',
      'cypress/fixtures/snow_drops.jpg',
      'cypress/fixtures/multi_jpg/aurelia_jpg.xml',
      'cypress/fixtures/multi_jpg/aurelia.jpg',
      'cypress/fixtures/multi_jpg/henreys_grave.xml',
      'cypress/fixtures/multi_jpg/henreys_grave.jpg',
      'cypress/fixtures/multi_jpg/the_past.xml',
      'cypress/fixtures/multi_jpg/the_past.jpg'
    ], { force: true })
    cy.waitImport()
    cy.get('#nav-download-tab').click()
    cy.wait(250)
    cy.get('#downloadFormat').click()
    cy.get('#formatLabelOptionText').click()
    cy.wait(250)
    cy.get('#download').click()
    cy.verifyDownload('snow_drops.txt', { contains: true })

  })

  it('downloads a pdf file from jpg with hOCR (xml for browserstack but data from tess), NATIVE', () => {
    cy.get('#openFileInput').selectFile([
      'cypress/fixtures/multi_jpg/the_past.xml',
      'cypress/fixtures/multi_jpg/the_past.jpg'
    ], { force: true })
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
    cy.verifyDownload('the_past.pdf', { contains: true })

  })

  it('downloads a pdf file from jpg with hOCR (xml for browserstack but data from tess), BINARY', () => {
    cy.get('#openFileInput').selectFile([
      'cypress/fixtures/multi_jpg/the_past.xml',
      'cypress/fixtures/multi_jpg/the_past.jpg'
    ], { force: true })
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
    cy.verifyDownload('the_past.pdf', { contains: true })

  })

  it('downloads a pdf file from 4 jpgs with 4 hOCRs (xml for browserstack but data from tess)', () => {
    cy.get('#openFileInput').selectFile([
      'cypress/fixtures/snow_drops.xml',
      'cypress/fixtures/snow_drops.jpg',
      'cypress/fixtures/multi_jpg/aurelia_jpg.xml',
      'cypress/fixtures/multi_jpg/aurelia.jpg',
      'cypress/fixtures/multi_jpg/henreys_grave.xml',
      'cypress/fixtures/multi_jpg/henreys_grave.jpg',
      'cypress/fixtures/multi_jpg/the_past.xml',
      'cypress/fixtures/multi_jpg/the_past.jpg'
    ], { force: true })
    cy.waitImport()
    cy.get('#nav-download-tab').click()
    cy.wait(250)
    cy.get('#downloadFormat').click()
    cy.get('#formatLabelOptionPDF').click()
    cy.wait(250)
    cy.get('#download').click()
    cy.verifyDownload('snow_drops.pdf', { contains: true })

  })

  it('downloads a hocr file from jpg', () => {
    cy.get('#openFileInput').selectFile([
      'cypress/fixtures/multi_jpg/henreys_grave.xml',
      'cypress/fixtures/multi_jpg/henreys_grave.jpg',
    ], { force: true })
    cy.waitImport()
    cy.get('#nav-download-tab').click()
    cy.wait(250)
    cy.get('#downloadFormat').click()
    cy.get('#formatLabelOptionHOCR').click()
    cy.wait(250)
    cy.get('#download').click()
    cy.verifyDownload('henreys_grave.hocr', { contains: true })

  })

  it('downloads a hocr file from 4 jpgs', () => {
    cy.get('#openFileInput').selectFile([
      'cypress/fixtures/snow_drops.jpg',
      'cypress/fixtures/snow_drops.xml',
      'cypress/fixtures/multi_jpg/aurelia_jpg.xml',
      'cypress/fixtures/multi_jpg/aurelia.jpg',
      'cypress/fixtures/multi_jpg/henreys_grave.xml',
      'cypress/fixtures/multi_jpg/henreys_grave.jpg',
      'cypress/fixtures/multi_jpg/the_past.xml',
      'cypress/fixtures/multi_jpg/the_past.jpg'
    ], { force: true })
    cy.waitImport()
    cy.get('#nav-download-tab').click()
    cy.wait(250)
    cy.get('#downloadFormat').click()
    cy.get('#formatLabelOptionHOCR').click()
    cy.wait(250)
    cy.get('#download').click()
    cy.verifyDownload('snow_drops.hocr', { contains: true })

  })

})
