//Please replace httpServer with the correct address for your testing server or an environment variable
const httpServer = 'http://192.168.50.10:8080';
//const httpServer = 'https://scribeocr.com/';

describe('It recognises and downloads a', () => {
  beforeEach(() => {
    cy.visit(httpServer);
    cy.get('#nav-import-tab').click();
  })

  it('text file from a png with no imported ocr data', () => {
    cy.get('#uploader').selectFile(['cypress/fixtures/multi_png/aurelia.png'])
    cy.wait(3000)
    cy.get('#pageCount').should('have.text', '1')
    
    
    cy.get('#nav-recognize-tab').click()
    cy.get('#recognizeAll').click()
    cy.wait(15000)

    cy.get('#nav-download-tab').click()
    cy.get('#downloadFormat').click()
    cy.get('#formatLabelOptionText').click()
    cy.get('#save2').click()
    cy.verifyDownload('aurelia.txt')
  })

  it('text file from 4 pngs with no imported ocr data', () => {
    cy.get('#uploader').selectFile([
      'cypress/fixtures/multi_png/henreys_grave.png', 
      'cypress/fixtures/multi_png/aurelia.png',
      'cypress/fixtures/multi_png/the_past.png', 
      'cypress/fixtures/pretty_faces.png'
    ])
    cy.wait(10000)
    cy.get('#pageCount').should('have.text', '4')
    
    
    cy.get('#nav-recognize-tab').click()
    cy.get('#recognizeAll').click()
    cy.wait(35000)

    cy.get('#nav-download-tab').click()
    cy.get('#downloadFormat').click()
    cy.get('#formatLabelOptionText').click()
    cy.get('#save2').click()
    cy.verifyDownload('henreys_grave.txt')
  })

  it('pdf file from a png with no imported ocr data', () => {
    cy.get('#uploader').selectFile(['cypress/fixtures/multi_png/the_past.png'])
    cy.wait(3000)
    cy.get('#pageCount').should('have.text', '1')
    
    cy.get('#nav-recognize-tab').click()
    cy.get('#recognizeAll').click()
    cy.wait(15000)

    cy.get('#nav-download-tab').click()
    cy.get('#downloadFormat').click()
    cy.get('#formatLabelOptionPDF').click()
    cy.get('#save2').click()
    cy.verifyDownload('the_past.pdf')
  })

  it('pdf file from 4 pngs with no imported ocr data', () => {
    cy.get('#uploader').selectFile([
      'cypress/fixtures/multi_png/aurelia.png', 
      'cypress/fixtures/multi_png/henreys_grave.png',
      'cypress/fixtures/multi_png/the_past.png', 
      'cypress/fixtures/pretty_faces.png'
    ])
    cy.wait(10000)
    cy.get('#pageCount').should('have.text', '4')

    cy.get('#nav-recognize-tab').click()
    cy.get('#recognizeAll').click()
    cy.wait(35000)


    cy.get('#nav-download-tab').click()
    cy.get('#downloadFormat').click()
    cy.get('#formatLabelOptionPDF').click()
    cy.get('#save2').click()
    cy.verifyDownload('aurelia.pdf')
  })

  it('hocr file from a png with no imported ocr data', () => {
    cy.get('#uploader').selectFile(['cypress/fixtures/pretty_faces.png'])
    cy.wait(3000)
    cy.get('#pageCount').should('have.text', '1')

    cy.get('#nav-recognize-tab').click()
    cy.get('#recognizeAll').click()
    cy.wait(15000)

    cy.get('#nav-download-tab').click()
    cy.get('#downloadFormat').click()
    cy.get('#formatLabelOptionHOCR').click()
    cy.get('#save2').click()
    cy.verifyDownload('pretty_faces.hocr')
  })

  it('text file from 4 pngs with no imported ocr data', () => {
    cy.get('#uploader').selectFile([
      'cypress/fixtures/multi_png/the_past.png', 
      'cypress/fixtures/multi_png/henreys_grave.png',
      'cypress/fixtures/multi_png/aurelia.png', 
      'cypress/fixtures/pretty_faces.png',
    ])
    cy.wait(10000)
    cy.get('#pageCount').should('have.text', '4')

    cy.get('#nav-recognize-tab').click()
    cy.get('#recognizeAll').click()
    cy.wait(35000)

    cy.get('#nav-download-tab').click()
    cy.get('#downloadFormat').click()
    cy.get('#formatLabelOptionHOCR').click()  
    cy.get('#save2').click()
    cy.verifyDownload('the_past.hocr')
  })

})