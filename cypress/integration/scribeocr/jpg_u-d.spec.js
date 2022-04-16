//Please replace httpServer with the correct address for your testing server or an environment variable
const httpServer = 'http://192.168.50.10:8080';
//const httpServer = 'https://scribeocr.com/';

describe('It', () => {
  beforeEach(() => {
    cy.visit(httpServer);
    cy.get('#nav-import-tab').click();
  })

  it('downloads a text file from jpg with hOCR (xml for browserstack but data from tess)', () => {
    cy.get('#uploader').selectFile([
      'cypress/fixtures/multi_jpg/henreys_grave.hocr',
      'cypress/fixtures/multi_jpg/henreys_grave.jpg'
    ])
    cy.get('#pageCount').should('have.text', '1')
    cy.wait(500)
    cy.get('#nav-download-tab').click()
    cy.get('#downloadFormat').click()
    cy.get('#formatLabelOptionText').click()
    cy.get('#save2').click()
    cy.verifyDownload('henreys_grave', {contains: true})
    
  })
  
  it('downloads a text file from 4 jpgs with 4 hOCRs (xml for browserstack but data from tess)', () => {
    cy.get('#uploader').selectFile([
      'cypress/fixtures/snow_drops.xml', 
      'cypress/fixtures/snow_drops.jpg',
      'cypress/fixtures/multi_jpg/aurelia_jpg.hocr',
      'cypress/fixtures/multi_jpg/aurelia.jpg',
      'cypress/fixtures/multi_jpg/henreys_grave.hocr',
      'cypress/fixtures/multi_jpg/henreys_grave.jpg',
      'cypress/fixtures/multi_jpg/the_past.hocr',
      'cypress/fixtures/multi_jpg/the_past.jpg'
    ])
    cy.get('#pageCount').should('have.text', '4')
    cy.get('#nav-download-tab').click()
    cy.get('#downloadFormat').click()
    cy.get('#formatLabelOptionText').click()
    cy.get('#save2').click()
    cy.verifyDownload('snow_drops.txt', {contains: true})
    
  }) 

  it('downloads a pdf file from jpg with hOCR (xml for browserstack but data from tess)', () => {
    cy.get('#uploader').selectFile([
      'cypress/fixtures/multi_jpg/the_past.hocr',
      'cypress/fixtures/multi_jpg/the_past.jpg'
    ])
    cy.get('#pageCount').should('have.text', '1')
    cy.wait(3000)
    cy.get('#nav-download-tab').click()
    cy.get('#downloadFormat').click()
    cy.get('#formatLabelOptionPDF').click()
    cy.get('#save2').click()
    cy.verifyDownload('snow_drops.pdf', {contains: true})
    
  })
  
  it('downloads a pdf file from 4 jpgs with 4 hOCRs (xml for browserstack but data from tess)', () => {
    cy.get('#uploader').selectFile([
      'cypress/fixtures/snow_drops.xml', 
      'cypress/fixtures/snow_drops.jpg',
      'cypress/fixtures/multi_jpg/aurelia_jpg.hocr',
      'cypress/fixtures/multi_jpg/aurelia.jpg',
      'cypress/fixtures/multi_jpg/henreys_grave.hocr',
      'cypress/fixtures/multi_jpg/henreys_grave.jpg',
      'cypress/fixtures/multi_jpg/the_past.hocr',
      'cypress/fixtures/multi_jpg/the_past.jpg'
    ])
    cy.get('#pageCount').should('have.text', '4')
    cy.wait(3000)
    cy.get('#nav-download-tab').click()
    cy.get('#downloadFormat').click()
    cy.get('#formatLabelOptionPDF').click()
    cy.get('#save2').click()
    cy.verifyDownload('snow_drops.pdf', {contains: true})
    
  }) 

  it('downloads a hocr file from jpg)', () => {
    cy.get('#uploader').selectFile([
      'cypress/fixtures/multi_jpg/aurelia_jpg.hocr',
      'cypress/fixtures/multi_jpg/aurelia.jpg',
    ])
    cy.get('#pageCount').should('have.text', '1')
    cy.wait(3000)
    cy.get('#nav-download-tab').click()
    cy.get('#downloadFormat').click()
    cy.get('#formatLabelOptionHOCR').click()
    cy.get('#save2').click()
    cy.verifyDownload('aurelia_jpg.hocr', {contains: true})

  })

  it('downloads a hocr file from 4 jpgs)', () => {
    cy.get('#uploader').selectFile([
      'cypress/fixtures/snow_drops.xml', 
      'cypress/fixtures/snow_drops.jpg',
      'cypress/fixtures/multi_jpg/aurelia_jpg.hocr',
      'cypress/fixtures/multi_jpg/aurelia.jpg',
      'cypress/fixtures/multi_jpg/henreys_grave.hocr',
      'cypress/fixtures/multi_jpg/henreys_grave.jpg',
      'cypress/fixtures/multi_jpg/the_past.hocr',
      'cypress/fixtures/multi_jpg/the_past.jpg'
    ])
    cy.get('#pageCount').should('have.text', '4')
    cy.get('#nav-download-tab').click()
    cy.get('#downloadFormat').click()
    cy.get('#formatLabelOptionHOCR').click()
    cy.get('#save2').click()
    cy.verifyDownload('snow_drops.hocr', {contains: true})
    
  }) 
  
})
