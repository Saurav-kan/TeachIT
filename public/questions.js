export function answerSinceQuestion(question,transcript){
  if(!question)return '';
  return transcript.startsWith(question.baseline)?transcript.slice(question.baseline.length).trim():transcript;
}

export function advanceQuestion(current,result,baseline,id){
  if(current&&current.status!=='answered'){
    const assessment=result.answerAssessment;
    if(assessment?.questionId!==current.id)return current;
    return {...current,status:assessment.status==='unaddressed'?current.status:assessment.status,feedback:assessment.feedback,evidence:assessment.evidence};
  }
  if(!result.question?.trim())return current;
  return {id,student:result.student,question:result.question,baseline,status:'waiting',feedback:'',evidence:''};
}
