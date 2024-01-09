

describe('Produces output files from image upload and no OCR data for', () => {
  beforeEach(() => {
    cy.visit('/');
    cy.window().should('have.property', 'appReady', true);
  })

  it('pdf with no imported ocr data, produces download files in supported formats (.txt, .docx, .pdf, and .hocr)', () => {
    cy.get('#openFileInput').selectFile(['cypress/fixtures/multi_pdf_nd/aurelia.pdf', 'cypress/fixtures/multi_png/aurelia_abbyy.xml'], { force: true })
    cy.waitImport()

    cy.get('#nav-download-tab').click()
    cy.wait(250)

    cy.downloadAllFormats('aurelia');
  })


  it('image with no imported ocr data, produces download files in supported formats (.txt, .docx, .pdf, and .hocr)', () => {
    cy.get('#openFileInput').selectFile(['cypress/fixtures/multi_png/aurelia.png', 'cypress/fixtures/multi_png/aurelia_abbyy.xml'], { force: true })
    cy.waitImport()

    cy.get('#nav-download-tab').click()
    cy.wait(250)

    cy.downloadAllFormats('aurelia');

  })

  it('3 pngs with imported ocr data', () => {
    cy.get('#openFileInput').selectFile([
      'cypress/fixtures/multi_png/henreys_grave.png',
      'cypress/fixtures/multi_png/aurelia.png',
      'cypress/fixtures/multi_png/the_past.png',
      'cypress/fixtures/multi_png/henreys_grave_abbyy.xml',
      'cypress/fixtures/multi_png/aurelia_abbyy.xml',
      'cypress/fixtures/multi_png/the_past_abbyy.xml',
    ], { force: true })
    cy.waitImport()

    cy.get('#nav-download-tab').click()
    cy.wait(250)

    cy.downloadAllFormats('henreys_grave');
  })

})
