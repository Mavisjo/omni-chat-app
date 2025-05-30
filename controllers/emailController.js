const nodemailer = require('nodemailer');
const BotService = require('../services/botService');

// Create email transporter
const createTransporter = () => {
  return nodemailer.createTransporter({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    tls: {
      rejectUnauthorized: false // For development only
    }
  });
};

exports.sendEmail = async (req, res) => {
  try {
    const { to, subject, text, html, fromName } = req.body;
    
    if (!to || !subject || (!text && !html)) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: to, subject, and text or html'
      });
    }
    
    const transporter = createTransporter();
    
    // Verify transporter configuration
    await transporter.verify();
    
    const fromAddress = fromName 
      ? `${fromName} <${process.env.SMTP_FROM || process.env.SMTP_USER}>`
      : process.env.SMTP_FROM || process.env.SMTP_USER;
    
    // Send the original email
    const mailOptions = {
      from: fromAddress,
      to,
      subject,
      text,
      html
    };
    
    const result = await transporter.sendMail(mailOptions);
    console.log('📤 Email sent to:', to, 'MessageId:', result.messageId);
    
    // Generate and send auto-reply using bot service
    const autoReply = BotService.generateEmailAutoReply(subject, to);
    
    const autoReplyOptions = {
      from: fromAddress,
      to,
      subject: autoReply.subject,
      text: autoReply.message,
      inReplyTo: result.messageId,
      references: result.messageId
    };
    
    // Send auto-reply
    const autoReplyResult = await transporter.sendMail(autoReplyOptions);
    console.log('🤖 Auto-reply sent to:', to, 'MessageId:', autoReplyResult.messageId);
    
    res.status(200).json({
      success: true,
      message: 'Email sent successfully with auto-reply',
      data: {
        originalEmail: {
          messageId: result.messageId,
          to,
          subject
        },
        autoReply: {
          messageId: autoReplyResult.messageId,
          subject: autoReply.subject
        }
      }
    });
    
  } catch (error) {
    console.error('❌ Email send failed:', error);
    
    // Provide more specific error messages
    let errorMessage = 'Failed to send email';
    if (error.code === 'EAUTH') {
      errorMessage = 'Email authentication failed. Check your credentials.';
    } else if (error.code === 'ECONNECTION') {
      errorMessage = 'Could not connect to email server. Check your SMTP settings.';
    } else if (error.responseCode === 550) {
      errorMessage = 'Email rejected by recipient server.';
    }
    
    res.status(500).json({
      success: false,
      error: errorMessage,
      details: error.message,
      code: error.code
    });
  }
};

exports.sendAutoReplyOnly = async (req, res) => {
  try {
    const { to, originalSubject } = req.body;
    
    if (!to || !originalSubject) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: to, originalSubject'
      });
    }
    
    const transporter = createTransporter();
    const autoReply = BotService.generateEmailAutoReply(originalSubject, to);
    
    const mailOptions = {
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to,
      subject: autoReply.subject,
      text: autoReply.message
    };
    
    const result = await transporter.sendMail(mailOptions);
    console.log('🤖 Auto-reply sent to:', to);
    
    res.status(200).json({
      success: true,
      message: 'Auto-reply sent successfully',
      data: {
        messageId: result.messageId,
        to,
        subject: autoReply.subject
      }
    });
    
  } catch (error) {
    console.error('❌ Auto-reply send failed:', error);
    
    // Provide more specific error messages
    let errorMessage = 'Failed to send auto-reply';
    if (error.code === 'EAUTH') {
      errorMessage = 'Email authentication failed. Check your credentials.';
    } else if (error.code === 'ECONNECTION') {
      errorMessage = 'Could not connect to email server. Check your SMTP settings.';
    } else if (error.responseCode === 550) {
      errorMessage = 'Email rejected by recipient server.';
    }
    
    res.status(500).json({
      success: false,
      error: errorMessage,
      details: error.message,
      code: error.code
    });
  }
};