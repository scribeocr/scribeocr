

describe('It downloads a', () => {
  beforeEach(() => {
    cy.visit('/');
    cy.window().should('have.property', 'appReady', true);
  })
  it('text file from a pdf with different page numbered xml', () => {
    cy.get('#openFileInput').selectFile(
      ['cypress/fixtures/siegeofcorinthpo00byrorich_abbyy.xml',
        'cypress/fixtures/siegeofcorinthpo00byrorich_bw.pdf'
      ], { force: true })
    cy.waitImport()
    cy.get('#nav-download-tab').click()
    cy.wait(250)
    cy.get('#downloadFormat').click()
    cy.get('#formatLabelOptionText').click()
    cy.wait(250)
    cy.get('#download').click()
    cy.verifyDownload('siegeofcorinthpo00byrorich_bw.txt')
  })
  /*
   it('downloads a pdf file from a pdf with different page numbered xml, COLOR', () => {
     cy.get('#openFileInput').selectFile(
       ['cypress/fixtures/siegeofcorinthpo00byrorich_abbyy.xml', 'cypress/fixtures/siegeofcorinthpo00byrorich_bw.pdf'])
     cy.get('#pageCount').should('have.text', '114')
 
     cy.get('#nav-view-tab').click()
 cy.wait(250)
     cy.get('#colorMode').select('Color')
     
 
     cy.get('#nav-download-tab').click()
 cy.wait(250)
     cy.get('#downloadFormat').click()
     cy.get('#formatLabelOptionPDF').click()
     cy.wait(250)
 cy.get('#download').click()
     cy.wait(130000)
     cy.verifyDownload('siegeofcorinthpo00byrorich_bw.pdf', {contains: true})
   })
  
   it('downloads a hocr file from a pdf with different page numbered xml', () => {
     cy.get('#openFileInput').selectFile(
       ['cypress/fixtures/siegeofcorinthpo00byrorich_abbyy.xml', 'cypress/fixtures/siegeofcorinthpo00byrorich_bw.pdf'])
     cy.get('#pageCount').should('have.text', '114')
     cy.get('#nav-download-tab').click()
 cy.wait(250)
     cy.get('#downloadFormat').click()
     cy.get('#formatLabelOptionHOCR').click()
     cy.wait(15000)
     cy.wait(250)
 cy.get('#download').click()
     cy.verifyDownload('siegeofcorinthpo00byrorich_bw.hocr', {contains: true})
   })
   */
})
