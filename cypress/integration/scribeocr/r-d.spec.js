const httpServer = Cypress.env('TESTSITE');

describe('It recognises and downloads a', () => {
  beforeEach(() => {
    cy.visit(httpServer);
  })

  // JPG Recognize -> Download 

  it('text file from a jpg with no imported ocr data', () => {
    cy.get('#openFileInput').selectFile(['cypress/fixtures/multi_jpg/aurelia.jpg'], { force: true })
    cy.waitImport()

    cy.get('#nav-recognize-tab').click()
    cy.wait(250)
    cy.get('#recognizeAll').click()
    cy.get('#recognize-recognize-progress-collapse .progress-bar').then(($el) => {
      const maxValue = $el.attr('aria-valuemax');

      // Check if the 'aria-valuenow' attribute is equal to 'aria-valuemax'
      cy.wrap($el, { timeout: 60000 }).should('have.attr', 'aria-valuenow', maxValue);
    });
    cy.get('#nav-download-tab').click()
    cy.wait(250)
    cy.get('#downloadFormat').click()
    cy.get('#formatLabelOptionText').click()
    cy.wait(250)
    cy.get('#download').click()
    cy.verifyDownload('aurelia.txt')
  })

  it('text file from 4 jpgs with no imported ocr data', () => {
    cy.get('#openFileInput').selectFile([
      'cypress/fixtures/multi_jpg/henreys_grave.jpg',
      'cypress/fixtures/multi_jpg/aurelia.jpg',
      'cypress/fixtures/multi_jpg/the_past.jpg',
      'cypress/fixtures/snow_drops.jpg'
    ], { force: true })
    cy.waitImport()

    cy.get('#nav-recognize-tab').click()
    cy.wait(250)
    cy.get('#recognizeAll').click()
    cy.get('#recognize-recognize-progress-collapse .progress-bar').then(($el) => {
      const maxValue = $el.attr('aria-valuemax');

      // Check if the 'aria-valuenow' attribute is equal to 'aria-valuemax'
      cy.wrap($el, { timeout: 60000 }).should('have.attr', 'aria-valuenow', maxValue);
    });
    cy.get('#nav-download-tab').click()
    cy.wait(250)
    cy.get('#downloadFormat').click()
    cy.get('#formatLabelOptionText').click()
    cy.wait(250)
    cy.get('#download').click()
    cy.verifyDownload('henreys_grave.txt')
  })

  it('pdf file from a jpg with no imported ocr data, NATIVE', () => {
    cy.get('#openFileInput').selectFile(['cypress/fixtures/multi_jpg/the_past.jpg'], { force: true })
    cy.waitImport()

    cy.get('#nav-recognize-tab').click()
    cy.wait(250)
    cy.get('#recognizeAll').click()
    cy.get('#recognize-recognize-progress-collapse .progress-bar').then(($el) => {
      const maxValue = $el.attr('aria-valuemax');

      // Check if the 'aria-valuenow' attribute is equal to 'aria-valuemax'
      cy.wrap($el, { timeout: 60000 }).should('have.attr', 'aria-valuenow', maxValue);
    });
    cy.get('#nav-view-tab').click()
    cy.wait(250)
    cy.get('#colorMode').select('Native')

    cy.get('#nav-download-tab').click()
    cy.wait(250)
    cy.get('#downloadFormat').click()
    cy.get('#formatLabelOptionPDF').click()
    cy.wait(250)
    cy.get('#download').click()
    cy.verifyDownload('the_past', { contains: true })
  })

  it('pdf file from a jpg with no imported ocr data, BINARY', () => {
    cy.get('#openFileInput').selectFile(['cypress/fixtures/multi_jpg/the_past.jpg'], { force: true })
    cy.waitImport()

    cy.get('#nav-recognize-tab').click()
    cy.wait(250)
    cy.get('#recognizeAll').click()
    cy.get('#recognize-recognize-progress-collapse .progress-bar').then(($el) => {
      const maxValue = $el.attr('aria-valuemax');

      // Check if the 'aria-valuenow' attribute is equal to 'aria-valuemax'
      cy.wrap($el, { timeout: 60000 }).should('have.attr', 'aria-valuenow', maxValue);
    });
    cy.get('#nav-view-tab').click()
    cy.wait(250)
    cy.get('#colorMode').select('Binary')

    cy.get('#nav-download-tab').click()
    cy.wait(250)
    cy.get('#downloadFormat').click()
    cy.get('#formatLabelOptionPDF').click()
    cy.wait(250)
    cy.get('#download').click()
    cy.verifyDownload('the_past', { contains: true })
  })

  it('pdf file from 4 jpgs with no imported ocr data', () => {
    cy.get('#openFileInput').selectFile([
      'cypress/fixtures/multi_jpg/aurelia.jpg',
      'cypress/fixtures/multi_jpg/henreys_grave.jpg',
      'cypress/fixtures/multi_jpg/the_past.jpg',
      'cypress/fixtures/snow_drops.jpg'
    ], { force: true })
    cy.waitImport()

    cy.get('#nav-recognize-tab').click()
    cy.wait(250)
    cy.get('#recognizeAll').click()
    cy.get('#recognize-recognize-progress-collapse .progress-bar').then(($el) => {
      const maxValue = $el.attr('aria-valuemax');

      // Check if the 'aria-valuenow' attribute is equal to 'aria-valuemax'
      cy.wrap($el, { timeout: 60000 }).should('have.attr', 'aria-valuenow', maxValue);
    });

    cy.get('#nav-download-tab').click()
    cy.wait(250)
    cy.get('#downloadFormat').click()
    cy.get('#formatLabelOptionPDF').click()
    cy.wait(250)
    cy.get('#download').click()
    cy.verifyDownload('aurelia.pdf')
  })

  it('hocr file from a jpg with no imported ocr data', () => {
    cy.get('#openFileInput').selectFile(['cypress/fixtures/snow_drops.jpg'], { force: true })
    cy.waitImport()

    cy.get('#nav-recognize-tab').click()
    cy.wait(250)
    cy.get('#recognizeAll').click()
    cy.get('#recognize-recognize-progress-collapse .progress-bar').then(($el) => {
      const maxValue = $el.attr('aria-valuemax');

      // Check if the 'aria-valuenow' attribute is equal to 'aria-valuemax'
      cy.wrap($el, { timeout: 60000 }).should('have.attr', 'aria-valuenow', maxValue);
    });
    cy.get('#nav-download-tab').click()
    cy.wait(250)
    cy.get('#downloadFormat').click()
    cy.get('#formatLabelOptionHOCR').click()
    cy.wait(250)
    cy.get('#download').click()
    cy.verifyDownload('snow_drops.hocr')
  })

  it('text file from 4 jpgs with no imported ocr data', () => {
    cy.get('#openFileInput').selectFile([
      'cypress/fixtures/multi_jpg/the_past.jpg',
      'cypress/fixtures/multi_jpg/henreys_grave.jpg',
      'cypress/fixtures/multi_jpg/aurelia.jpg',
      'cypress/fixtures/snow_drops.jpg',
    ], { force: true })
    cy.waitImport()

    cy.get('#nav-recognize-tab').click()
    cy.wait(250)
    cy.get('#recognizeAll').click()
    cy.get('#recognize-recognize-progress-collapse .progress-bar').then(($el) => {
      const maxValue = $el.attr('aria-valuemax');

      // Check if the 'aria-valuenow' attribute is equal to 'aria-valuemax'
      cy.wrap($el, { timeout: 60000 }).should('have.attr', 'aria-valuenow', maxValue);
    });
    cy.get('#nav-download-tab').click()
    cy.wait(250)
    cy.get('#downloadFormat').click()
    cy.get('#formatLabelOptionHOCR').click()
    cy.wait(250)
    cy.get('#download').click()
    cy.verifyDownload('the_past.hocr')
  })

  // PDF Recognize -> Download 

  it('text file from a pdf with no imported ocr data', () => {
    cy.get('#openFileInput').selectFile(['cypress/fixtures/multi_pdf_nd/aurelia.pdf'], { force: true })
    cy.waitImport()

    cy.get('#nav-recognize-tab').click()
    cy.wait(250)
    cy.get('#recognizeAll').click()
    cy.get('#recognize-recognize-progress-collapse .progress-bar').then(($el) => {
      const maxValue = $el.attr('aria-valuemax');

      // Check if the 'aria-valuenow' attribute is equal to 'aria-valuemax'
      cy.wrap($el, { timeout: 60000 }).should('have.attr', 'aria-valuenow', maxValue);
    });
    cy.get('#nav-download-tab').click()
    cy.wait(250)
    cy.get('#downloadFormat').click()
    cy.get('#formatLabelOptionText').click()
    cy.wait(250)
    cy.get('#download').click()
    cy.verifyDownload('aurelia.txt')
  })
  /*
    it('recognises and downloads a text file from 5 pdfs with no imported ocr data', () => {
      cy.get('#openFileInput').selectFile([
        'cypress/fixtures/multi_pdf_nd/snow_drops.pdf', 
        'cypress/fixtures/multi_pdf_nd/aurelia.pdf',
        'cypress/fixtures/multi_pdf_nd/henreys_grave.pdf', 
        'cypress/fixtures/multi_pdf_nd/pretty_faces.pdf',
        'cypress/fixtures/multi_pdf_nd/the_past.pdf'
      ])
      cy.wait(10000)
      cy.get('#pageCount').should('have.text', '5')
      
      
      cy.get('#nav-recognize-tab').click()
  cy.wait(250)
      cy.get('#recognizeAll').click()
      cy.wait(10000)
  
      cy.get('#nav-download-tab').click()
  cy.wait(250)
      cy.get('#downloadFormat').click()
      cy.get('#formatLabelOptionText').click()
      cy.wait(250)
  cy.get('#download').click()
      cy.verifyDownload('snow_drops.txt')
    })
  */
  it('r & d pdf from pdf, no imported ocr data, COLOR', () => {
    cy.get('#openFileInput').selectFile(['cypress/fixtures/multi_pdf_nd/the_past.pdf'], { force: true })
    cy.waitImport()

    cy.get('#nav-recognize-tab').click()
    cy.wait(250)
    cy.get('#recognizeAll').click()

    cy.get('#recognize-recognize-progress-collapse .progress-bar').then(($el) => {
      const maxValue = $el.attr('aria-valuemax');

      // Check if the 'aria-valuenow' attribute is equal to 'aria-valuemax'
      cy.wrap($el, { timeout: 60000 }).should('have.attr', 'aria-valuenow', maxValue);
    });
    cy.get('#nav-view-tab').click()
    cy.wait(250)
    cy.get('#colorMode').select('Color')


    cy.get('#nav-download-tab').click()
    cy.wait(250)
    cy.get('#downloadFormat').click()
    cy.get('#formatLabelOptionPDF').click()
    cy.wait(250)
    cy.get('#download').click()
    cy.verifyDownload('the_past.pdf')
  })

  it('r & d pdf from pdf, no imported ocr data, BINARY', () => {
    cy.get('#openFileInput').selectFile(['cypress/fixtures/multi_pdf_nd/henreys_grave.pdf'], { force: true })
    cy.waitImport()

    cy.get('#nav-recognize-tab').click()
    cy.wait(250)
    cy.get('#recognizeAll').click()

    cy.get('#recognize-recognize-progress-collapse .progress-bar').then(($el) => {
      const maxValue = $el.attr('aria-valuemax');

      // Check if the 'aria-valuenow' attribute is equal to 'aria-valuemax'
      cy.wrap($el, { timeout: 60000 }).should('have.attr', 'aria-valuenow', maxValue);
    });
    cy.get('#nav-view-tab').click()
    cy.wait(250)
    cy.get('#colorMode').select('Binary')


    cy.get('#nav-download-tab').click()
    cy.wait(250)
    cy.get('#downloadFormat').click()
    cy.get('#formatLabelOptionPDF').click()
    cy.wait(250)
    cy.get('#download').click()
    cy.verifyDownload('henreys_grave.pdf')
  })
  /*
    it('recognises and downloads a pdf file from 5 pdfs with no imported ocr data', () => {
      cy.get('#openFileInput').selectFile([
        'cypress/fixtures/multi_pdf_nd/the_past.pdf', 
        'cypress/fixtures/multi_pdf_nd/aurelia.pdf',
        'cypress/fixtures/multi_pdf_nd/henreys_grave.pdf', 
        'cypress/fixtures/multi_pdf_nd/pretty_faces.pdf',
        'cypress/fixtures/multi_pdf_nd/snow_drops.pdf'
      ])
      cy.wait(10000)
      cy.get('#pageCount').should('have.text', '5')
  
      cy.get('#nav-recognize-tab').click()
  cy.wait(250)
      cy.get('#recognizeAll').click()
      cy.wait(10000)
  
  
      cy.get('#nav-download-tab').click()
  cy.wait(250)
      cy.get('#downloadFormat').click()
      cy.get('#formatLabelOptionPDF').click()
      cy.wait(250)
  cy.get('#download').click()
      cy.verifyDownload('the_past.pdf')
    })
  */
  it('hocr file from a pdf with no imported ocr data', () => {
    cy.get('#openFileInput').selectFile(['cypress/fixtures/multi_pdf_nd/pretty_faces.pdf'], { force: true })
    cy.waitImport()

    cy.get('#nav-recognize-tab').click()
    cy.wait(250)
    cy.get('#recognizeAll').click()
    cy.get('#recognize-recognize-progress-collapse .progress-bar').then(($el) => {
      const maxValue = $el.attr('aria-valuemax');

      // Check if the 'aria-valuenow' attribute is equal to 'aria-valuemax'
      cy.wrap($el, { timeout: 60000 }).should('have.attr', 'aria-valuenow', maxValue);
    });
    cy.get('#nav-download-tab').click()
    cy.wait(250)
    cy.get('#downloadFormat').click()
    cy.get('#formatLabelOptionHOCR').click()
    cy.wait(250)
    cy.get('#download').click()
    cy.verifyDownload('pretty_faces.hocr')
  })
  /*
    it('recognises and downloads a text file from 5 pdfs with no imported ocr data', () => {
      cy.get('#openFileInput').selectFile([
        'cypress/fixtures/multi_pdf_nd/pretty_faces.pdf', 
        'cypress/fixtures/multi_pdf_nd/aurelia.pdf',
        'cypress/fixtures/multi_pdf_nd/henreys_grave.pdf', 
        'cypress/fixtures/multi_pdf_nd/snow_drops.pdf',
        'cypress/fixtures/multi_pdf_nd/the_past.pdf'
      ])
      cy.wait(10000)
      cy.get('#pageCount').should('have.text', '5')
  
      cy.get('#nav-recognize-tab').click()
  cy.wait(250)
      cy.get('#recognizeAll').click()
      cy.wait(10000)
  
      cy.get('#nav-download-tab').click()
  cy.wait(250)
      cy.get('#downloadFormat').click()
      cy.get('#formatLabelOptionHOCR').click()  
      cy.wait(250)
  cy.get('#download').click()
      cy.verifyDownload('pretty_faces.hocr')
    })
  */

  //PNG Recognize -> Download

  it('text file from a png with no imported ocr data', () => {
    cy.get('#openFileInput').selectFile(['cypress/fixtures/multi_png/aurelia.png'], { force: true })
    cy.waitImport()


    cy.get('#nav-recognize-tab').click()
    cy.wait(250)
    cy.get('#recognizeAll').click()
    cy.get('#recognize-recognize-progress-collapse .progress-bar').then(($el) => {
      const maxValue = $el.attr('aria-valuemax');

      // Check if the 'aria-valuenow' attribute is equal to 'aria-valuemax'
      cy.wrap($el, { timeout: 60000 }).should('have.attr', 'aria-valuenow', maxValue);
    });
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
    cy.get('#recognize-recognize-progress-collapse .progress-bar').then(($el) => {
      const maxValue = $el.attr('aria-valuemax');

      // Check if the 'aria-valuenow' attribute is equal to 'aria-valuemax'
      cy.wrap($el, { timeout: 60000 }).should('have.attr', 'aria-valuenow', maxValue);
    });
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
    cy.get('#recognize-recognize-progress-collapse .progress-bar').then(($el) => {
      const maxValue = $el.attr('aria-valuemax');

      // Check if the 'aria-valuenow' attribute is equal to 'aria-valuemax'
      cy.wrap($el, { timeout: 60000 }).should('have.attr', 'aria-valuenow', maxValue);
    });
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
    cy.get('#recognize-recognize-progress-collapse .progress-bar').then(($el) => {
      const maxValue = $el.attr('aria-valuemax');

      // Check if the 'aria-valuenow' attribute is equal to 'aria-valuemax'
      cy.wrap($el, { timeout: 60000 }).should('have.attr', 'aria-valuenow', maxValue);
    });
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
    cy.get('#recognize-recognize-progress-collapse .progress-bar').then(($el) => {
      const maxValue = $el.attr('aria-valuemax');

      // Check if the 'aria-valuenow' attribute is equal to 'aria-valuemax'
      cy.wrap($el, { timeout: 60000 }).should('have.attr', 'aria-valuenow', maxValue);
    });

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
    cy.get('#recognize-recognize-progress-collapse .progress-bar').then(($el) => {
      const maxValue = $el.attr('aria-valuemax');

      // Check if the 'aria-valuenow' attribute is equal to 'aria-valuemax'
      cy.wrap($el, { timeout: 60000 }).should('have.attr', 'aria-valuenow', maxValue);
    });
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
    cy.get('#recognize-recognize-progress-collapse .progress-bar').then(($el) => {
      const maxValue = $el.attr('aria-valuemax');

      // Check if the 'aria-valuenow' attribute is equal to 'aria-valuemax'
      cy.wrap($el, { timeout: 60000 }).should('have.attr', 'aria-valuenow', maxValue);
    });
    cy.get('#nav-download-tab').click()
    cy.wait(250)
    cy.get('#downloadFormat').click()
    cy.get('#formatLabelOptionHOCR').click()
    cy.wait(250)
    cy.get('#download').click()
    cy.verifyDownload('the_past.hocr')
  })

})