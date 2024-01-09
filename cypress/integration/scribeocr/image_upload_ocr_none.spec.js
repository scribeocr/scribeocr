// This spec tests the case where ONLY image data is provided, with no OCR data from either recognition or upload.
// While this is a fringe case, it should not result in an error being thrown. 

describe('Produces output files from image upload and no OCR data for', () => {
  beforeEach(() => {
    cy.visit('/');
    cy.window().should('have.property', 'appReady', true);
  })

  it('pdf with no imported ocr data, produces download files in supported formats (.txt, .docx, .pdf, and .hocr)', () => {
    cy.get('#openFileInput').selectFile(['cypress/fixtures/multi_pdf_nd/aurelia.pdf'], { force: true })
    cy.waitImport()


    cy.get('#nav-recognize-tab').click()
    cy.wait(250)
    cy.get('#recognizeAll').click()

    cy.get('#recognize-recognize-progress-collapse .progress-bar').then(($el) => {
      const maxValue = $el.attr('aria-valuemax');

      // Check if the 'aria-valuenow' attribute is equal to 'aria-valuemax'
      cy.wrap($el).should('have.attr', 'aria-valuenow', maxValue);
    });
    cy.get('#nav-download-tab').click()
    cy.wait(250)

    cy.downloadAllFormats('aurelia');
  })


  it('image with no imported ocr data, produces download files in supported formats (.txt, .docx, .pdf, and .hocr)', () => {
    cy.get('#openFileInput').selectFile(['cypress/fixtures/multi_png/aurelia.png'], { force: true })
    cy.waitImport()

    cy.get('#nav-recognize-tab').click()
    cy.wait(250)
    cy.get('#recognizeAll').click()

    cy.get('#recognize-recognize-progress-collapse .progress-bar').then(($el) => {
      const maxValue = $el.attr('aria-valuemax');

      // Check if the 'aria-valuenow' attribute is equal to 'aria-valuemax'
      cy.wrap($el).should('have.attr', 'aria-valuenow', maxValue);
    });
    cy.get('#nav-download-tab').click()
    cy.wait(250)

    cy.downloadAllFormats('aurelia');

  })

  it('4 pngs with no imported ocr data', () => {
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
    cy.downloadAllFormats('henreys_grave');
  })

})
