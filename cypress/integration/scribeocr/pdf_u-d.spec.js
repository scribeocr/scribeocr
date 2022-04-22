//Please replace httpServer with the correct address for your testing server or an environment variable
//const httpServer = 'http://192.168.50.10:8080';
const httpServer = 'https://scribeocr.com/';

describe('It downloads a', () => {
  beforeEach(() => {
    cy.visit(httpServer);
    cy.get('#nav-import-tab').click();
  })
  it('text file from a pdf with different page numbered xml', () => {
    cy.get('#uploader').selectFile(
      ['cypress/fixtures/siegeofcorinthpo00byrorich_abbyy.xml', 
        'cypress/fixtures/siegeofcorinthpo00byrorich_bw.pdf'
    ])
    cy.get('#pageCount').should('have.text', '114')
    cy.wait(5000)
    cy.get('#nav-download-tab').click()
    cy.get('#downloadFormat').click()
    cy.get('#formatLabelOptionText').click()
    cy.wait(5000)
    cy.get('#download').click()
    cy.verifyDownload('siegeofcorinthpo00byrorich_bw.txt')
  })
 
  it('downloads a pdf file from a pdf with different page numbered xml', () => {
    cy.get('#uploader').selectFile(
      ['cypress/fixtures/siegeofcorinthpo00byrorich_abbyy.xml', 'cypress/fixtures/siegeofcorinthpo00byrorich_bw.pdf'])
    cy.get('#pageCount').should('have.text', '114')
    cy.get('#nav-download-tab').click()
    cy.get('#downloadFormat').click()
    cy.get('#formatLabelOptionPDF').click()
    cy.get('#download').click()
    cy.wait(130000)
    cy.verifyDownload('siegeofcorinthpo00byrorich_bw.pdf', {contains: true})
  })
  it('downloads a hocr file from a pdf with different page numbered xml', () => {
    cy.get('#uploader').selectFile(
      ['cypress/fixtures/siegeofcorinthpo00byrorich_abbyy.xml', 'cypress/fixtures/siegeofcorinthpo00byrorich_bw.pdf'])
    cy.get('#pageCount').should('have.text', '114')
    cy.get('#nav-download-tab').click()
    cy.get('#downloadFormat').click()
    cy.get('#formatLabelOptionHOCR').click()
    cy.wait(15000)
    cy.get('#download').click()
    cy.verifyDownload('siegeofcorinthpo00byrorich_bw.hocr', {contains: true})
  })
  
})
