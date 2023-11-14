const httpServer = Cypress.env('TESTSITE');

describe('It recognises and downloads a', () => {
  beforeEach(() => {
    cy.visit(httpServer);
    
cy.wait(500);
  })

  it('text file from a png with no imported ocr data', () => {
    cy.get('#openFileInput').selectFile(['cypress/fixtures/multi_png/aurelia.png'], { force: true })
    cy.wait(3000)
    cy.get('#pageCount').should('have.text', '1')
    
    
    cy.get('#nav-recognize-tab').click()
cy.wait(500)
    cy.get('#recognizeAll').click()
    cy.wait(15000)

    cy.get('#nav-download-tab').click()
cy.wait(500)
    cy.get('#downloadFormat').click()
    cy.get('#formatLabelOptionText').click()
    cy.wait(500)
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
    cy.wait(10000)
    cy.get('#pageCount').should('have.text', '4')
    
    
    cy.get('#nav-recognize-tab').click()
cy.wait(500)
    cy.get('#recognizeAll').click()
    cy.wait(35000)

    cy.get('#nav-download-tab').click()
cy.wait(500)
    cy.get('#downloadFormat').click()
    cy.get('#formatLabelOptionText').click()
    cy.wait(500)
cy.get('#download').click()
    cy.verifyDownload('henreys_grave.txt')
  })

  it('pdf file from a png with no imported ocr data, NATIVE', () => {
    cy.get('#openFileInput').selectFile(['cypress/fixtures/multi_png/the_past.png'], { force: true })
    cy.wait(3000)
    cy.get('#pageCount').should('have.text', '1')
    
    cy.get('#nav-recognize-tab').click()
cy.wait(500)
    cy.get('#recognizeAll').click()
    cy.wait(15000)

    cy.get('#nav-view-tab').click()
cy.wait(500)
    cy.get('#colorMode').select('Native')
    
    cy.get('#nav-download-tab').click()
cy.wait(500)
    cy.get('#downloadFormat').click()
    cy.get('#formatLabelOptionPDF').click()
    cy.wait(500)
cy.get('#download').click()
    cy.verifyDownload('the_past.pdf')
  })

  it('pdf file from a png with no imported ocr data, BINARY', () => {
    cy.get('#openFileInput').selectFile(['cypress/fixtures/multi_png/the_past.png'], { force: true })
    cy.wait(3000)
    cy.get('#pageCount').should('have.text', '1')
    
    cy.get('#nav-recognize-tab').click()
cy.wait(500)
    cy.get('#recognizeAll').click()
    cy.wait(15000)

    cy.get('#nav-view-tab').click()
cy.wait(500)
    cy.get('#colorMode').select('Binary')
    
    cy.get('#nav-download-tab').click()
cy.wait(500)
    cy.get('#downloadFormat').click()
    cy.get('#formatLabelOptionPDF').click()
    cy.wait(500)
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
    cy.wait(10000)
    cy.get('#pageCount').should('have.text', '4')

    cy.get('#nav-recognize-tab').click()
cy.wait(500)
    cy.get('#recognizeAll').click()
    cy.wait(35000)


    cy.get('#nav-download-tab').click()
cy.wait(500)
    cy.get('#downloadFormat').click()
    cy.get('#formatLabelOptionPDF').click()
    cy.wait(500)
cy.get('#download').click()
    cy.verifyDownload('aurelia.pdf')
  })

  it('hocr file from a png with no imported ocr data', () => {
    cy.get('#openFileInput').selectFile(['cypress/fixtures/pretty_faces.png'], { force: true })
    cy.wait(3000)
    cy.get('#pageCount').should('have.text', '1')

    cy.get('#nav-recognize-tab').click()
cy.wait(500)
    cy.get('#recognizeAll').click()
    cy.wait(15000)

    cy.get('#nav-download-tab').click()
cy.wait(500)
    cy.get('#downloadFormat').click()
    cy.get('#formatLabelOptionHOCR').click()
    cy.wait(500)
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
    cy.wait(10000)
    cy.get('#pageCount').should('have.text', '4')

    cy.get('#nav-recognize-tab').click()
cy.wait(500)
    cy.get('#recognizeAll').click()
    cy.wait(35000)

    cy.get('#nav-download-tab').click()
cy.wait(500)
    cy.get('#downloadFormat').click()
    cy.get('#formatLabelOptionHOCR').click()  
    cy.wait(500)
cy.get('#download').click()
    cy.verifyDownload('the_past.hocr')
  })

})