//Please replace httpServer with the correct address for your testing server or an environment variable
const httpServer = 'http://192.168.50.10:8080';
//const httpServer = 'https://scribeocr.com/';

describe('It recognises and downloads a', () => {
  beforeEach(() => {
    cy.visit(httpServer);
    cy.get('#nav-import-tab').click();
  })

  it('text file from a jpg with no imported ocr data', () => {
    cy.get('#uploader').selectFile(['cypress/fixtures/multi_jpg/aurelia.jpg'])
    cy.wait(3000)
    cy.get('#pageCount').should('have.text', '1')
    
    
    cy.get('#nav-recognize-tab').click()
    cy.get('#recognizeAll').click()
    cy.wait(10000)

    cy.get('#nav-download-tab').click()
    cy.get('#downloadFormat').click()
    cy.get('#formatLabelOptionText').click()
    cy.get('#save2').click()
    cy.verifyDownload('aurelia.txt')
  })

  it('text file from 4 jpgs with no imported ocr data', () => {
    cy.get('#uploader').selectFile([
      'cypress/fixtures/multi_jpg/henreys_grave.jpg', 
      'cypress/fixtures/multi_jpg/aurelia.jpg',
      'cypress/fixtures/multi_jpg/the_past.jpg', 
      'cypress/fixtures/snow_drops.jpg'
    ])
    cy.wait(10000)
    cy.get('#pageCount').should('have.text', '4')
    
    
    cy.get('#nav-recognize-tab').click()
    cy.get('#recognizeAll').click()
    cy.wait(30000)

    cy.get('#nav-download-tab').click()
    cy.get('#downloadFormat').click()
    cy.get('#formatLabelOptionText').click()
    cy.get('#save2').click()
    cy.verifyDownload('henreys_grave.txt')
  })

  it('pdf file from a jpg with no imported ocr data', () => {
    cy.get('#uploader').selectFile(['cypress/fixtures/multi_jpg/the_past.jpg'])
    cy.wait(3000)
    cy.get('#pageCount').should('have.text', '1')
    
    cy.get('#nav-recognize-tab').click()
    cy.get('#recognizeAll').click()
    cy.wait(10000)

    cy.get('#nav-download-tab').click()
    cy.get('#downloadFormat').click()
    cy.get('#formatLabelOptionPDF').click()
    cy.get('#save2').click()
    cy.verifyDownload('the_past.pdf')
  })

  it('pdf file from 4 jpgs with no imported ocr data', () => {
    cy.get('#uploader').selectFile([
      'cypress/fixtures/multi_jpg/aurelia.jpg', 
      'cypress/fixtures/multi_jpg/henreys_grave.jpg',
      'cypress/fixtures/multi_jpg/the_past.jpg', 
      'cypress/fixtures/snow_drops.jpg'
    ])
    cy.wait(10000)
    cy.get('#pageCount').should('have.text', '4')

    cy.get('#nav-recognize-tab').click()
    cy.get('#recognizeAll').click()
    cy.wait(30000)


    cy.get('#nav-download-tab').click()
    cy.get('#downloadFormat').click()
    cy.get('#formatLabelOptionPDF').click()
    cy.get('#save2').click()
    cy.verifyDownload('aurelia.pdf')
  })

  it('hocr file from a jpg with no imported ocr data', () => {
    cy.get('#uploader').selectFile(['cypress/fixtures/snow_drops.jpg'])
    cy.wait(3000)
    cy.get('#pageCount').should('have.text', '1')

    cy.get('#nav-recognize-tab').click()
    cy.get('#recognizeAll').click()
    cy.wait(10000)

    cy.get('#nav-download-tab').click()
    cy.get('#downloadFormat').click()
    cy.get('#formatLabelOptionHOCR').click()
    cy.get('#save2').click()
    cy.verifyDownload('snow_drops.hocr')
  })

  it('text file from 4 jpgs with no imported ocr data', () => {
    cy.get('#uploader').selectFile([
      'cypress/fixtures/multi_jpg/the_past.jpg', 
      'cypress/fixtures/multi_jpg/henreys_grave.jpg',
      'cypress/fixtures/multi_jpg/aurelia.jpg', 
      'cypress/fixtures/snow_drops.jpg',
    ])
    cy.wait(10000)
    cy.get('#pageCount').should('have.text', '4')

    cy.get('#nav-recognize-tab').click()
    cy.get('#recognizeAll').click()
    cy.wait(30000)

    cy.get('#nav-download-tab').click()
    cy.get('#downloadFormat').click()
    cy.get('#formatLabelOptionHOCR').click()  
    cy.get('#save2').click()
    cy.verifyDownload('the_past.hocr')
  })

})