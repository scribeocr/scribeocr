//Please replace httpServer with the correct address for your testing server or an environment variable
const httpServer = 'http://192.168.50.10:8080';

describe('Download', () => {
  beforeEach(() => {
    cy.visit(httpServer);
    cy.get('#nav-import-tab').click();
  })
  it('text file from jpg with hOCR', () => {
    cy.get('#nav-import-tab').click()
    cy.get('#uploader').selectFile(['cypress/fixtures/jpeg_hocr/snow_drops.hocr', 'cypress/fixtures/jpeg_hocr/snow_drops.jpg'])
    cy.get('#importProgress').should('be.visible')
    cy.get('#pageCount').should('have.text', '1')
    cy.get('#nav-download-tab').click()
    cy.get('#downloadFormat').click()
    cy.get('#formatLabelOptionText').click()
    cy.get('#save2').click()
    cy.verifyDownload('snow_drops.txt')
    
  })
  /*
  it('pdf file from jpg with hOCR', () => {
    cy.get('#nav-import-tab').click()
    cy.get('#uploader').selectFile(['cypress/fixtures/jpeg_hocr/snow_drops.hocr', 'cypress/fixtures/jpeg_hocr/snow_drops.jpg'])
    cy.get('#importProgress').should('be.visible')
    cy.get('#pageCount').should('have.text', '1')
    cy.get('#nav-download-tab').click()
    cy.get('#downloadFormat').click()
    cy.get('#formatLabelOptionText').click()
    cy.get('#save2').click()
    cy.verifyDownload('.txt', {contains: true})
    
  }) 
  */
  it('text file from a png with hOCR', () => {
    cy.get('#uploader').selectFile(['cypress/fixtures/png_hocr/pretty_faces.hocr', 'cypress/fixtures/png_hocr/pretty_faces.png'])
    cy.get('#importProgress').should('be.visible')
    cy.get('#pageCount').should('have.text', '1')
    cy.get('#nav-download-tab').click()
    cy.get('#downloadFormat').click()
    cy.get('#formatLabelOptionText').click()
    cy.get('#save2').click()
    cy.verifyDownload('pretty_faces.txt', {contains: true})
  })
  /*
  it('pdf file from a png with hOCR', () => {
    cy.get('#uploader').selectFile(['cypress/fixtures/png_hocr/pretty_faces.hocr', 'cypress/fixtures/png_hocr/pretty_faces.png'])
    cy.get('#importProgress').should('be.visible')
    cy.get('#pageCount').should('have.text', '1')
    cy.get('#nav-download-tab').click()
    cy.get('#downloadFormat').click()
    cy.get('#formatLabelOptionText').click()
    cy.get('#save2').click()
    cy.verifyDownload('.txt', {contains: true})
  })
  */
  it('text file from a pdf with xml', () => {
    cy.get('#uploader').selectFile(
      ['cypress/fixtures/pdf_xml/siegeofcorinthpo00byrorich_abbyy.xml', 'cypress/fixtures/pdf_xml/siegeofcorinthpo00byrorich_bw.pdf'])
    cy.get('#importProgress').should('be.visible')
    cy.get('#pageCount').should('have.text', '118')
    cy.get('#nav-download-tab').click()
    cy.get('#downloadFormat').click()
    cy.get('#formatLabelOptionText').click()
    cy.get('#save2').click()
    cy.verifyDownload('siegeofcorinthpo00byrorich_bw.txt')
  })
  /*
  it('pdf file from a pdf with xml', () => {
    cy.get('#uploader').selectFile(
      ['cypress/fixtures/pdf_xml/siegeofcorinthpo00byrorich_abbyy.xml', 'cypress/fixtures/pdf_xml/siegeofcorinthpo00byrorich_bw.pdf'])
    cy.get('#importProgress').should('be.visible')
    cy.get('#pageCount').should('have.text', '118')
    cy.get('#nav-download-tab').click()
    cy.get('#downloadFormat').click()
    cy.get('#formatLabelOptionText').click()
    cy.get('#save2').click()
    cy.verifyDownload('.txt', {contains: true})
  })
  */
})
